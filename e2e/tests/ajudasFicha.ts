import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { arquivoPrivado, exigirPrivado, temPrivado } from "../privado";
import { abrirAba, enviarCru, expect, intencaoCrua } from "./ajudas";

// Ajudas do Lote 9 (ficha 5e): o Darion (privado/fixtures/fichas/darion.json, só no computador do mestre), criado
// pelo mestre, e abrir a janela da ficha. Sem a pasta privado/, todo teste que cria o Darion pula.

export const DARION_ID = "pers-darion";
export const PASTA_GRUPO = "pasta-grupo";

const FICHA = "fixtures/fichas/darion.json";
const arquivo = (
  temPrivado(FICHA) ? JSON.parse(readFileSync(arquivoPrivado(FICHA), "utf8")) : { ficha: {} }
) as { ficha: Record<string, unknown> };

/** A ficha do Darion como está na fixture (vazia sem a pasta privado/). */
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
  exigirPrivado(FICHA);
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
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
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

// V4a: uma aba por página do PDF (principal = Personagem, historia, magias) e a Configurar.
export type AbaDaFicha = "principal" | "historia" | "magias" | "configurar";

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

// Ajudas do V3 (handouts): criar um pela sala (sem passar pela tela) e abrir a janela dele.

/** Cria um handout pela sala (por um socket novo) e devolve o id. Padrão: na pasta Personagens, só do mestre. */
export async function criarHandoutPelaSala(p: Page, extra: object = {}): Promise<string> {
  const id = `h-${Math.random().toString(36).slice(2, 8)}`;
  const handout = {
    id,
    pastaId: "pasta-personagens",
    titulo: "Aviso",
    texto: "",
    fonte: "livro",
    visivel: { tipo: "mestre" },
    ...extra,
  };
  // Handout que os jogadores veem manda snapshot novo a todos (inclusive a quem pediu): quem pediu não recebe o
  // evento, e sim o snapshot que já traz o handout. A ajuda espera o que vier primeiro: erro, evento ou esse snapshot.
  const resposta = await p.evaluate(
    ({ intencao, handoutId }) =>
      new Promise<string | null>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        const fim = setTimeout(() => {
          ws.close();
          resolve(null);
        }, 8000);
        ws.onopen = () => ws.send(intencao);
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data as string);
          const traz = typeof e.data === "string" && e.data.includes(`"id":"${handoutId}"`);
          if (
            m.tipo === "erro" ||
            (m.tipo === "evento" && traz) ||
            (m.tipo === "snapshot" && traz)
          ) {
            clearTimeout(fim);
            ws.close();
            resolve(m.tipo === "erro" ? `erro ${m.dados.codigo}` : m.tipo);
          }
        };
      }),
    { intencao: intencaoCrua("handout.criar", { handout }), handoutId: id },
  );
  expect(resposta, `handout.criar: ${resposta}`).toMatch(/^(evento|snapshot)$/);
  return id;
}

/** Fichas → clique no handout → a janela dele. */
export async function abrirHandout(p: Page, handoutId: string) {
  await abrirAba(p, "fichas");
  await p.getByTestId(`handout-abrir-${handoutId}`).click();
  const janela = p.locator(`[data-testid="janela-handout"][data-handout-id="${handoutId}"]`);
  await expect(janela).toBeVisible();
  return janela;
}

/** Abre a ficha na aba Configurar e clica em "Importar PDF" (V3: o botão mora ali). O seletor de arquivo abre. */
export async function clicarImportarPdf(p: Page, personagemId: string) {
  const janela = await abrirFicha(p, personagemId, "configurar");
  await janela.getByTestId("editor-importar-pdf").click();
}

/** V6: escolhe o espaço no menu "Conjurar com espaço de:" (um nível, ou `pacto`). */
export async function escolherEspaco(p: Page, nivel: number | "pacto") {
  const menu = p.getByTestId("menu-espaco");
  await expect(menu).toBeVisible();
  await menu.getByTestId(`menu-espaco-${nivel}`).click();
  await expect(menu).toHaveCount(0);
}
