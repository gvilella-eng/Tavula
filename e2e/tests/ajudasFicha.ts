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
        const ws = new WebSocket(`ws://${location.host}/ws`);
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
