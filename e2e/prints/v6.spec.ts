import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { assets } from "../tests/ajudasAssets";
import { mandar } from "../tests/ajudasFicha";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote V6 (conjurar com espaço maior, dano por nível acima e "mandar ao chat"): Grimório em 1600×900 e
// 1280×720 e Pergaminho em 1600×900. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints v6

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

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
  console.log(`[V6] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[V6] FALHAS:\n - ${falhas.join("\n - ")}`);
});

async function escolherTema(p: Page, tema: string) {
  await p.getByTestId("aba-preferencias").click();
  await p.getByTestId(`tema-${tema}`).check({ force: true });
  await expect(p.locator("html")).toHaveAttribute("data-tema", tema);
  await p.getByTestId("aba-chat").click();
}

const janelaDe = (p: Page, id: string) =>
  p.locator(`[data-testid="janela-ficha"][data-personagem-id="${id}"]`);

async function abrirPelaLista(p: Page, id: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${id}`).dblclick();
  const j = janelaDe(p, id);
  await expect(j).toBeVisible();
  return j;
}

const MAGO = "pers-mago-v6";
const NPC = "pers-mago-npc-v6";

for (const c of COMBINACOES) {
  base(`v6 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(300_000);
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const rotulo = `${c.tema}-${c.nome}`;
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const ms = await entrarNoMapa(mesa, "mestre");
      const m = ms.pagina;
      await escolherTema(m, c.tema);
      await assets(m, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);

      await mandar(m, "personagem.criar", {
        personagem: {
          id: MAGO,
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores", ids: ["jogador-1"] },
          nome: "Vessa Arkhelm",
          tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 18 },
          ficha: {
            pvAtual: 24,
            pvMax: 24,
            classes: [{ classe: "Mago", nivel: 5 }],
            atributos: { int: 18 },
            habilidadeDeConjuracao: "int",
            espacosTotal: { "3": 0, "4": 3, "5": 2 },
            magias: [
              {
                nome: "Bola de Fogo",
                nivel: 3,
                escola: "Evocação",
                preparada: true,
                descricao: "Uma explosão de chamas.",
                dano: "8d6",
                tipo: "Fogo",
                salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
                emAtaques: true,
              },
              {
                nome: "Raio Ardente",
                nivel: 2,
                escola: "Evocação",
                preparada: true,
                descricao: "Três raios de fogo.",
                acerto: { tipo: "formula", atributo: "int", proficiente: true },
                dano: "2d6",
                tipo: "Fogo",
                porNivelAcima: "1d6",
              },
              {
                nome: "Escudo Arcano",
                nivel: 1,
                escola: "Abjuração",
                preparada: true,
                descricao: "Reação: +5 na CA.",
              },
              { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
            ],
          },
        },
      });
      await abrirAba(m, "chat");
      const j = await abrirPelaLista(m, MAGO);
      await j.getByTestId("ficha-aba-magias").click();
      await abrirAba(m, "chat");

      await tentar(`${rotulo} menu`, async () => {
        await j.getByTestId("magia-conjurar-0").click();
        await expect(m.getByTestId("menu-espaco")).toBeVisible();
        await foto(m, `${rotulo}-01-menu-de-espaco`, 300);
        await m.keyboard.press("Escape");
        await expect(m.getByTestId("menu-espaco")).toHaveCount(0);
        await foto(m, `${rotulo}-02-icone-na-linha-da-magia`, 300);
      });

      await tentar(`${rotulo} chat`, async () => {
        // Bola de Fogo sem "por nível acima" no campo: vale o texto do compêndio (1d6 por nível)
        await j.getByTestId("magia-conjurar-0").click();
        await m.getByTestId("menu-espaco-5").click();
        await expect(m.getByTestId("bloco-espaco")).toHaveCount(1);
        await foto(m, `${rotulo}-03-chat-cartao-e-bloco`);
        // o crítico: repete o ataque pelo chat (sem gastar espaço) até sair um 18 ou mais
        for (let i = 0; i < 80; i++) {
          if ((await m.locator('[data-testid="bloco-espaco"][data-critico="true"]').count()) > 0)
            break;
          await mandar(m, "chat.modelo", {
            modelo: "ataque",
            nome: "Raio Ardente",
            bonus: 7,
            dano: "2d6+4",
            danoTipo: "Fogo",
            margemCritico: 18,
            espaco: { nivel: 4, extra: "2d6" },
            como: MAGO,
          });
          await m.waitForTimeout(160);
        }
        await expect(
          m.locator('[data-testid="bloco-espaco"][data-critico="true"]').first(),
        ).toBeVisible();
        await m
          .locator('[data-testid="bloco-espaco"][data-critico="true"]')
          .first()
          .scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-04-chat-critico`);
      });

      await tentar(`${rotulo} ping`, async () => {
        await j.getByTestId("magia-pingar-0").click();
        await expect(m.getByTestId("magia-chat").last()).toBeVisible();
        await m.getByTestId("magia-chat-alternar").last().click();
        await foto(m, `${rotulo}-05-cartao-mandado-pelo-icone`);
      });

      await tentar(`${rotulo} ataques e magias`, async () => {
        await j.getByTestId("ficha-aba-principal").click();
        await expect(j.getByTestId("ataque-magia-0")).toBeVisible();
        await j.getByTestId("ataque-magia-0").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-06-icone-em-ataques-e-magias`, 300);
        await j.getByTestId("ataque-nome-magia-0").click();
        await expect(m.getByTestId("menu-espaco")).toBeVisible();
        await foto(m, `${rotulo}-07-menu-em-ataques-e-magias`, 300);
        await m.keyboard.press("Escape");
      });

      await tentar(`${rotulo} npc`, async () => {
        await mandar(m, "personagem.criar", {
          personagem: {
            id: NPC,
            pastaId: "pasta-npcs",
            editores: { tipo: "jogadores", ids: [] },
            nome: "Mago de Guerra",
            tokenPadrao: { cor: "#c0392b", tamanhoQuadrados: 1 },
            visao: { alcanceM: null, visaoNoEscuroM: 0 },
            ficha: {
              pvAtual: 40,
              pvMax: 40,
              apresentacao: "npc",
              npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide" },
              atributos: { for: 9, des: 14, con: 12, int: 18, sab: 12, car: 10 },
              habilidadeDeConjuracao: "int",
              espacosTotal: { "1": 2, "3": 2, "4": 1 },
              magias: [
                {
                  nome: "Escudo Arcano",
                  nivel: 1,
                  preparada: true,
                  descricao: "Reação: +5 na CA.",
                },
                {
                  nome: "Bola de Fogo",
                  nivel: 3,
                  preparada: true,
                  descricao: "Explosão de chamas.",
                  dano: "8d6",
                  tipo: "Fogo",
                  salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
                },
              ],
            },
          },
        });
        const n = await abrirPelaLista(m, NPC);
        await abrirAba(m, "chat");
        await expect(n.getByTestId("npc-bloco")).toBeVisible();
        await n.getByTestId("npc-conj-magia-1").click();
        await n.getByTestId("npc-conj-corpo-1").scrollIntoViewIfNeeded();
        await n.getByTestId("npc-conj-pingar-1").scrollIntoViewIfNeeded();
        await foto(m, `${rotulo}-08-npc-icone-ao-lado-do-conjurar`, 300);
        await n.getByTestId("npc-conj-conjurar-1").click();
        await expect(m.getByTestId("menu-espaco")).toBeVisible();
        await foto(m, `${rotulo}-09-npc-menu`, 300);
        await m.keyboard.press("Escape");
      });
    } finally {
      await mesa.fechar();
    }
  });
}
