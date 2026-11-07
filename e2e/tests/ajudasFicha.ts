import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua } from "./ajudas";

// Ajudas do Lote 9 (ficha 5e): o Darion da seção 8 do PROJETO.md (fixtures/fichas/darion.json), criado
// pelo mestre, e abrir a janela da ficha.

export const DARION_ID = "pers-darion";
export const PASTA_GRUPO = "pasta-grupo";

const arquivo = JSON.parse(
  readFileSync(new URL("../../fixtures/fichas/darion.json", import.meta.url), "utf8"),
) as { ficha: Record<string, unknown> };

/** A ficha do Darion como está na fixture. */
export const FICHA_DARION = arquivo.ficha;

/** Envia uma intenção por um socket novo e espera o evento (falha se a sala recusar). */
export async function mandar(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

/** Cria o Darion com a ficha da fixture; quem edita é o jogador-1 (a pasta é só do mestre). */
export async function criarDarion(
  mestre: Page,
  opcoes: { pastaId?: string; editores?: string[]; id?: string } = {},
) {
  await mandar(mestre, "personagem.criar", {
    personagem: {
      id: opcoes.id ?? DARION_ID,
      pastaId: opcoes.pastaId ?? "pasta-personagens",
      editores: { tipo: "jogadores", ids: opcoes.editores ?? ["jogador-1"] },
      nome: "Darion",
      tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 18 },
      ficha: FICHA_DARION,
    },
  });
}

/** Uma pasta que todos os jogadores veem (o item chega sem a ficha, salvo `ficha.verOutras`). */
export async function criarPastaDoGrupo(mestre: Page) {
  await mandar(mestre, "pasta.criar", {
    pasta: { id: PASTA_GRUPO, nome: "Grupo", ordem: 5, visivel: { tipo: "todos" } },
  });
}

/** Muda `ficha.verOutras`: a sala responde com snapshot (não com evento), então só envia e espera um instante. */
export async function ligarVerOutras(mestre: Page, valor: boolean) {
  await mestre.evaluate(
    (v) =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/ws`);
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              v: 1,
              id: `teste-${Math.random()}`,
              tipo: "permissao.alterar",
              dados: { capacidade: "ficha.verOutras", valor: v },
            }),
          );
          setTimeout(() => {
            ws.close();
            resolve();
          }, 500);
        };
      }),
    valor,
  );
}

export type AbaDaFicha =
  | "principal"
  | "magias"
  | "caracteristicas"
  | "equipamento"
  | "notas"
  | "configurar";

/** Fichas → duplo clique no item → a aba pedida. */
export async function abrirFicha(p: Page, personagemId: string, aba: AbaDaFicha = "principal") {
  await abrirAba(p, "fichas");
  await p.getByTestId(`ficha-abrir-${personagemId}`).dblclick();
  const janela = p.locator(`[data-testid="janela-ficha"][data-personagem-id="${personagemId}"]`);
  await expect(janela).toBeVisible();
  await janela.getByTestId(`ficha-aba-${aba}`).click();
  await expect(janela).toHaveAttribute("data-aba", aba);
  return janela;
}
