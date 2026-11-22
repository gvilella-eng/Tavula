import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { arquivoPrivado, exigirPrivado } from "../privado";
import { abrirAba, enviarCru, expect, importarCampanha, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";

// AU1 (ajustado no AU2): a lista das automações (frase em português, ligar e desligar, apagar com desfazer), o botão liberado ao
// jogador e a campanha Chama Primordial importada (a forma antiga vira grafo). O que era do editor dentro da janela principal
// (peças, ramos, erros no bloco, teclado, o efeito no mapa) foi para o au2.spec.ts, já na janela própria e com a grade.

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

type Aviso = { tipo?: string; texto?: string };
const anunciou = (frames: string[], texto: string) =>
  frames.some((f) => {
    try {
      const m = JSON.parse(f) as {
        tipo: string;
        dados: { tipo?: string; dados?: { mensagem?: Aviso }; estado?: { chat?: Aviso[] } };
      };
      const avisos =
        m.tipo === "evento" && m.dados.tipo === "chat.mensagem"
          ? [m.dados.dados?.mensagem]
          : m.tipo === "snapshot"
            ? (m.dados.estado?.chat ?? [])
            : [];
      return avisos.some((x) => x?.tipo === "aviso" && x.texto === texto);
    } catch {
      return false;
    }
  });

/** Abre a janela das automações (o botão da barra de cima). */
async function abrirAutomacoes(p: Page) {
  await p.getByTestId("menu-automacoes").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
}

const anuncio = (texto: string) => ({ bloco: "acao", acao: { acao: "chat.anunciar", texto } });
const fluxoDeBotao = (id: string, nome: string, texto: string) => ({
  id,
  nome,
  gatilho: { tipo: "botao", nome },
  trilhas: [[anuncio(texto)]],
});

test("o botão liberado ao jogador: o mestre libera pela lista e o jogador dispara pela barra", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", { fluxo: fluxoDeBotao("soprar", "Soprar", "O vento sopra") });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await expect(j1.pagina.getByTestId("botoes-da-barra")).toHaveCount(0);

  await abrirAutomacoes(p);
  await p.getByTestId("auto-menu-soprar").click();
  await p.getByTestId("auto-liberar-soprar").click();
  await expect(j1.pagina.getByTestId("chip-botao-soprar")).toBeVisible();
  // a definição não chega ao jogador: só o rótulo do botão
  expect(j1.frames.join("\n")).not.toContain("O vento sopra");
  await j1.pagina.getByTestId("chip-botao-soprar-disparar").click();
  await expect.poll(() => anunciou(j1.frames, "O vento sopra")).toBe(true);

  // fixar na barra do mestre também pela lista
  await p.getByTestId("auto-menu-soprar").click();
  await p.getByTestId("auto-fixar-soprar").click();
  await expect(p.getByTestId("chip-evento-soprar")).toBeVisible();
  // desfazendo a liberação, o chip some do jogador
  await p.getByTestId("auto-menu-soprar").click();
  await p.getByTestId("auto-liberar-soprar").click();
  await expect(j1.pagina.getByTestId("chip-botao-soprar")).toHaveCount(0);
});

test("editar, desligar e ligar, apagar e desfazer", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", { fluxo: fluxoDeBotao("aviso", "Aviso", "oi") });
  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-contagem")).toHaveText("1 automação · 1 ligada");

  // desligar e ligar pela chave
  const chave = p.getByTestId("auto-chave-aviso");
  await expect(chave).toHaveAttribute("aria-checked", "true");
  await chave.click();
  await expect(chave).toHaveAttribute("aria-checked", "false");
  await expect(p.getByTestId("auto-contagem")).toHaveText("1 automação · 0 ligadas");
  await p.getByTestId("auto-filtro-desligadas").click();
  await expect(p.getByTestId("auto-item-aviso")).toBeVisible();
  await p.getByTestId("auto-filtro-ligadas").click();
  await expect(p.getByTestId("auto-item-aviso")).toHaveCount(0);
  await p.getByTestId("auto-filtro-todas").click();
  await chave.click();
  await expect(chave).toHaveAttribute("aria-checked", "true");

  // editar: o editor abre com o que já existe, numa janela própria (AU2); mudar o nome e salvar
  const [editor] = await Promise.all([
    p.waitForEvent("popup"),
    p.getByTestId("auto-editar-aviso").click(),
  ]);
  await expect(editor.getByTestId("ed-nome")).toHaveValue("Aviso");
  await editor.getByTestId("ed-nome").fill("Aviso novo");
  await expect(editor.getByTestId("ed-desfazer")).toBeEnabled();
  await Promise.all([editor.waitForEvent("close"), editor.getByTestId("ed-salvar").click()]);
  await expect(p.getByTestId("auto-nome-aviso")).toHaveText("Aviso novo");

  // busca
  await p.getByTestId("auto-busca").fill("nada disso");
  await expect(p.getByTestId("auto-item-aviso")).toHaveCount(0);
  await p.getByTestId("auto-busca").fill("novo");
  await expect(p.getByTestId("auto-item-aviso")).toBeVisible();

  // duplicar nasce desligada; apagar leva um aviso com Desfazer
  await p.getByTestId("auto-menu-aviso").click();
  await p.getByTestId("auto-duplicar-aviso").click();
  await p.getByTestId("auto-busca").fill("");
  await expect(p.getByTestId("auto-contagem")).toHaveText("2 automações · 1 ligada");
  await p.getByTestId("auto-menu-aviso").click();
  await p.getByTestId("auto-apagar-aviso").click();
  await expect(p.getByTestId("auto-item-aviso")).toHaveCount(0);
  await expect(p.getByTestId("auto-desfazer-aviso")).toContainText("Aviso novo");
  await p.getByTestId("auto-desfazer").click();
  await expect(p.getByTestId("auto-nome-aviso")).toHaveText("Aviso novo");
});

test("a Chama Primordial importada: a forma antiga vira fluxos, com a frase em português na lista", async ({
  mesa,
}) => {
  exigirPrivado("fixtures/campanhas/chama-primordial.json");
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await importarCampanha(p, {
    name: "chama-primordial.json",
    mimeType: "application/json",
    buffer: readFileSync(arquivoPrivado("fixtures/campanhas/chama-primordial.json")),
  });
  await expect(p.getByTestId("automacoes-resumo")).toHaveText("5 automações · 5 ligadas");
  // o ciclo vinha fixado na barra
  await expect(p.getByTestId("chip-ciclo-respiracao")).toBeVisible();
  await p.getByTestId("automacoes-abrir").click();
  await expect(p.getByTestId("auto-nome-respiracao")).toHaveText("Respiração do Pulmão");
  await expect(p.getByTestId("auto-frase-respiracao")).toContainText(
    "A cada 3 min, na cena Pulmão da Montanha:",
  );
  await expect(p.getByTestId("auto-frase-respiracao")).toContainText(
    "90 s depois, a visão de cada token",
  );
  await expect(p.getByTestId("auto-gatilho-botao-rajada")).toContainText("Rajada de vento");
  await expect(p.getByText("Quando um token entra na zona Ar Morto").first()).toBeVisible();
  await expect(p.getByText("Quando uma tocha acende").first()).toBeVisible();
  // abrir o editor de uma convertida (numa janela própria) mostra o grafo (gatilho, para cada tocha, luz, sortear...)
  const [editor] = await Promise.all([
    p.waitForEvent("popup"),
    p.getByTestId("auto-editar-rx-tocha-inspiracao").click(),
  ]);
  await expect(editor.locator('[data-testid^="ed-no-"][data-tipo="gatilho"]')).toContainText(
    "Sinal “inspiracao”",
  );
  await expect(editor.locator('[data-testid^="ed-no-"][data-tipo="paraCada"]')).toContainText(
    "Para cada objeto",
  );
  await expect(editor.getByTestId("ed-frase")).toContainText("30% de chance de apagar");
  await editor.close();
});
