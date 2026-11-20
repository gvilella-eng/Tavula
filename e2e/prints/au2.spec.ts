import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  test as base,
  enviarCru,
  expect,
  importarCampanha,
  intencaoCrua,
} from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Prints do lote AU2 (automações como o n8n): a lista, o editor em grade numa janela própria (a Respiração arrumada, um nó
// escolhido, a armadilha com OU, E e NÃO, o erro no nó, a busca de peças) e a mesa de eventos (janela e faixa). Fora do
// `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints au2

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

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

const quadrado = (x: number, y: number) => [
  { x, y },
  { x: x + 4, y },
  { x: x + 4, y: y + 4 },
  { x, y: y + 4 },
];

for (const c of CASOS) {
  base(`au2 ${c.nome}`, async ({ mesa }) => {
    base.setTimeout(240_000);
    const m = (await entrarNoMapa(mesa, "mestre")).pagina;
    await m.setViewportSize({ width: c.width, height: c.height });
    await escolherTema(m, c.tema);
    const foto = async (pagina: Page, nome: string) => {
      await pagina.waitForTimeout(500);
      await pagina.screenshot({ path: join(PASTA as string, `${c.nome}-${nome}.png`) });
    };

    // a Chama Primordial: a forma antiga entra convertida em grafo
    await abrirAba(m, "mesa");
    await importarCampanha(m, {
      name: "chama-primordial.json",
      mimeType: "application/json",
      buffer: readFileSync(
        new URL("../../fixtures/campanhas/chama-primordial.json", import.meta.url),
      ),
    });
    await expect(m.getByTestId("chip-ciclo-respiracao")).toBeVisible();
    await m.getByTestId("menu-pausa").click();
    await m.getByTestId("menu-automacoes").click();
    await expect(m.getByTestId("automacoes-lista")).toBeVisible();
    await foto(m, "01-lista");

    // a armadilha com OU de zonas, E e NÃO (feita pelo grafo, como o Claude a monta)
    await ok(m, "zona.criar", {
      zona: {
        id: "za",
        cenaId: "pulmao",
        nome: "Zona A",
        pontos: quadrado(5, 5),
        ativa: true,
        efeitos: {},
      },
    });
    await ok(m, "zona.criar", {
      zona: {
        id: "zb",
        cenaId: "pulmao",
        nome: "Zona B",
        pontos: quadrado(15, 5),
        ativa: true,
        efeitos: {},
      },
    });
    await ok(m, "fluxo.criar", {
      fluxo: {
        id: "armadilha",
        nome: "Armadilha OU",
        cenas: null,
        ligado: true,
        nos: [
          {
            id: "a",
            tipo: "gatilho",
            x: 40,
            y: 40,
            config: { tipo: "zona", quando: "entra", zona: "za" },
          },
          {
            id: "b",
            tipo: "gatilho",
            x: 40,
            y: 170,
            config: { tipo: "zona", quando: "entra", zona: "zb" },
          },
          { id: "jog", tipo: "condicao", x: 40, y: 330, config: { condicao: "tokenDeJogador" } },
          { id: "nao", tipo: "porta", x: 300, y: 330, config: { porta: "nao" } },
          {
            id: "meio",
            tipo: "condicao",
            x: 300,
            y: 450,
            config: { condicao: "chance", chance: 0.5 },
          },
          { id: "e", tipo: "porta", x: 560, y: 390, config: { porta: "e" } },
          { id: "se", tipo: "se", x: 560, y: 100, config: {} },
          {
            id: "cada",
            tipo: "paraCada",
            x: 830,
            y: 40,
            config: { alvo: { tipo: "objetos", acesos: true } },
          },
          {
            id: "apaga",
            tipo: "acao",
            x: 1090,
            y: 40,
            config: { acao: { acao: "objeto.apagar", chance: 1 } },
          },
          {
            id: "aviso",
            tipo: "acao",
            x: 830,
            y: 200,
            config: { acao: { acao: "chat.anunciar", texto: "Escapou!", para: "mestre" } },
          },
        ],
        fios: [
          { de: { no: "a", saida: "saida" }, para: { no: "se", entrada: "entrada" } },
          { de: { no: "b", saida: "saida" }, para: { no: "se", entrada: "entrada" } },
          { de: { no: "jog", saida: "valor" }, para: { no: "nao", entrada: "entrada" } },
          { de: { no: "nao", saida: "valor" }, para: { no: "e", entrada: "entradas" } },
          { de: { no: "meio", saida: "valor" }, para: { no: "e", entrada: "entradas" } },
          { de: { no: "e", saida: "valor" }, para: { no: "se", entrada: "condicao" } },
          { de: { no: "se", saida: "sim" }, para: { no: "cada", entrada: "entrada" } },
          { de: { no: "cada", saida: "corpo" }, para: { no: "apaga", entrada: "entrada" } },
          { de: { no: "se", saida: "nao" }, para: { no: "aviso", entrada: "entrada" } },
        ],
      },
    });
    await ok(m, "fluxo.criar", {
      fluxo: {
        id: "trovao",
        nome: "Trovão",
        gatilho: { tipo: "botao", nome: "Trovão", cor: "azul", icone: "trovao" },
        trilhas: [[{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "Troveja!" } }]],
      },
    });
    await ok(m, "fluxo.criar", {
      fluxo: {
        id: "sino",
        nome: "Sino",
        gatilho: { tipo: "botao", nome: "Sino da taverna", cor: "verde", icone: "sino" },
        trilhas: [[{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "Dlin dlon" } }]],
      },
    });

    // o editor, sempre numa janela própria: a Respiração (duas trilhas em paralelo, para cada, esperar)
    const abrir = async (testid: string) => {
      const [e] = await Promise.all([m.waitForEvent("popup"), m.getByTestId(testid).click()]);
      await e.setViewportSize({ width: c.width, height: c.height });
      await expect(e.getByTestId("ed-raiz")).toBeVisible();
      return e;
    };
    const e1 = await abrir("auto-editar-respiracao");
    await e1.getByTestId("ed-zoom-ajustar").click();
    await foto(e1, "02-editor-respiracao");
    await e1.locator('[data-testid^="ed-no-"][data-tipo="paraCada"]').first().click();
    await foto(e1, "03-editor-no-escolhido");
    await e1.close();

    // a armadilha: dois gatilhos em OU, NÃO, E e o se
    const e2 = await abrir("auto-editar-armadilha");
    await e2.getByTestId("ed-zoom-ajustar").click();
    await e2.getByTestId("ed-no-se").click();
    await foto(e2, "04-editor-portas-logicas");
    // Organizar põe tudo em colunas sozinho
    await e2.getByTestId("ed-organizar").click();
    await foto(e2, "05-editor-organizado");
    await e2.close();

    // um erro no próprio nó, e a busca de peças com duplo clique
    const e3 = await abrir("auto-nova");
    await e3.getByTestId("ed-peca-luz").click();
    await e3.getByTestId("ed-salvar").click();
    await foto(e3, "06-editor-erro-no-no");
    const grade = await e3.getByTestId("ed-canvas").boundingBox();
    if (grade) await e3.mouse.dblclick(grade.x + grade.width * 0.3, grade.y + grade.height * 0.65);
    await expect(e3.getByTestId("ed-busca")).toBeVisible();
    await foto(e3, "07-editor-busca-de-pecas");
    await e3.close();

    // a mesa de eventos: janela flutuante e faixa no pé da tela
    await m.getByTestId("auto-abrir-mesa-de-eventos").click();
    await expect(m.getByTestId("painel-eventos")).toBeVisible();
    await m.getByTestId("evento-botao-trovao").click();
    await foto(m, "08-mesa-de-eventos-janela");
    await m.getByTestId("eventos-encaixar").click();
    await m.getByTestId("automacoes-fechar").click();
    await expect(m.getByTestId("eventos-faixa")).toBeVisible();
    await foto(m, "09-mesa-de-eventos-faixa");
  });
}
