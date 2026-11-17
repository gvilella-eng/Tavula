import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { abrirAba, expect, test } from "./ajudas";
import { assets } from "./ajudasAssets";
import { escolherEspaco, mandar } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";

// Q9: a Conjuração do NPC usa o mesmo componente de círculos da aba Magias do personagem: espaços totais e restantes,
// uma linha por magia com Conjurar, chat e engrenagem, "+ Círculo", recuperar e soltar do compêndio.

const TEXTO_DO_SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const MAGO = "pers-mago-q9";

async function criarMagoNpc(mestre: Page) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: MAGO,
      pastaId: "pasta-npcs",
      editores: { tipo: "jogadores", ids: [] },
      nome: "Mago Q9",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      ficha: {
        pvAtual: 40,
        pvMax: 40,
        apresentacao: "npc",
        npc: { nd: "5", tamanho: "Médio", tipo: "Humanoide" },
        atributos: { for: 9, des: 14, con: 12, int: 18, sab: 12, car: 10 },
        habilidadeDeConjuracao: "int",
        espacosTotal: { "1": 2, "3": 1 },
        inata: { habilidade: "int", cd: 13 },
        magias: [
          { nome: "Luz", nivel: 0, preparada: true, descricao: "O objeto emite luz." },
          { nome: "Mísseis Mágicos", nivel: 1, preparada: true, descricao: "Dardos de força." },
          {
            nome: "Detectar Magia",
            nivel: 1,
            preparada: true,
            descricao: "Sente a magia.",
            inata: { frequencia: "vontade" },
          },
          {
            nome: "Relâmpago",
            nivel: 3,
            preparada: true,
            descricao: "Uma linha de raios.",
            inata: { frequencia: "cada", max: 1 },
          },
        ],
      },
    },
  });
}

async function abrirConjuracao(p: Page) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${MAGO}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${MAGO}"]`);
  await expect(janela.getByTestId("npc-bloco")).toBeVisible();
  await janela.getByTestId("npc-fita-conjuracao").click();
  await expect(janela.getByTestId("npc-fita-conjuracao")).toHaveAttribute("aria-selected", "true");
  return janela;
}

const centro = async (l: Locator) => {
  const b = (await l.boundingBox()) as { x: number; y: number; width: number; height: number };
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test("a Conjuração do NPC tem os círculos da aba Magias: espaços, conjurar, recuperar, + Círculo, soltar e a inata", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await criarMagoNpc(p);
  const janela = await abrirConjuracao(p);

  // os círculos com espaços totais e restantes, como no personagem
  await expect(janela.getByTestId("npc-espaco-total-1")).toHaveValue("2");
  await expect(janela.getByTestId("npc-espacos-restantes-1")).toHaveText("2");
  await expect(janela.getByTestId("npc-espaco-total-3")).toHaveValue("1");
  // uma linha por magia, sem o "Prep." do personagem
  await expect(janela.getByTestId("npc-conj-item-1")).toContainText("Mísseis Mágicos");
  await expect(janela.getByTestId("npc-conj-conjurar-1")).toBeVisible();
  await expect(janela.getByTestId("npc-conj-prep-1")).toHaveCount(0);
  await expect(janela.getByTestId("npc-conj-preparada-1")).toHaveCount(0);
  // a inata fica de fora dos círculos
  await expect(janela.getByTestId("npc-conj-item-2")).toHaveCount(0);

  // conjurar uma de 1º círculo gasta um espaço e manda o cartão ao chat
  await janela.getByTestId("npc-conj-conjurar-1").click();
  await escolherEspaco(p, 1);
  await expect(janela.getByTestId("npc-espacos-restantes-1")).toHaveText("1");
  await expect(janela.getByTestId("npc-espaco-1-2")).not.toBeChecked();
  await abrirAba(p, "chat");
  await expect(p.getByTestId("chat-mensagem").filter({ hasText: "Mísseis Mágicos" })).toHaveCount(
    1,
  );
  await abrirAba(p, "fichas");

  // recuperar devolve
  await janela.getByTestId("npc-recuperar-espacos").click();
  await expect(janela.getByTestId("npc-espacos-restantes-1")).toHaveText("2");

  // a linha abre o texto e o "mandar ao chat" da própria linha
  await janela.getByTestId("npc-conj-magia-1").click();
  await expect(janela.getByTestId("npc-conj-texto-1")).toHaveText("Dardos de força.");
  await expect(janela.getByTestId("npc-conj-chat-1")).toBeVisible();

  // + Círculo mostra o 2º círculo vazio
  await expect(janela.getByTestId("npc-conj-nivel-2")).toHaveCount(0);
  await janela.getByTestId("npc-conj-mais-circulo").click();
  await expect(janela.getByTestId("npc-conj-nivel-2")).toBeVisible();

  // arrastar uma magia do compêndio cai no círculo dela
  await assets(p, "adicionarNaPasta", "compendio/magias.json", TEXTO_DO_SRD);
  await abrirAba(p, "compendio");
  await p.getByTestId("compendio-secao-magias").click();
  const bola = p.locator('[data-testid="compendio-item"][data-nome="Bola de Fogo"]');
  await bola.scrollIntoViewIfNeeded();
  const alvo = janela.getByTestId("npc-conj-nivel-3");
  await alvo.scrollIntoViewIfNeeded();
  const o = await centro(bola);
  await p.mouse.move(o.x, o.y);
  await p.mouse.down();
  await p.mouse.move(o.x + 12, o.y + 12, { steps: 4 });
  const a = await centro(alvo);
  await p.mouse.move(a.x, a.y, { steps: 14 });
  await p.mouse.move(a.x + 1, a.y, { steps: 2 });
  await expect(alvo).toHaveAttribute("data-aceita-soltar", "true");
  await p.mouse.up();
  await expect(alvo).toContainText("Bola de Fogo");

  // a inata continua: À vontade e 1/dia com a bolinha
  await expect(janela.getByTestId("npc-inata-linha-vontade")).toContainText("Detectar Magia");
  await expect(janela.getByTestId("npc-inata-linha-cada-1")).toContainText("Relâmpago");
});
