import { readFileSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, importarCampanha, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// AU1: as automações por blocos, de ponta a ponta: a lista (frase em português, ligar e desligar, apagar com desfazer), o
// editor (peças, ramos, erros no bloco, teclado, janela própria), o efeito no mapa (luz que muda e volta, armadilha de zona),
// o botão liberado ao jogador e a campanha Chama Primordial importada (a forma antiga vira fluxos).

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";
const CENA = "cena-1";

const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const luzDe = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id);

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

async function acenderTocha(mestre: Page, novoId = "tocha-a") {
  await ok(mestre, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(mestre, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId });
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

test("criar pelo editor 'a cada 10 s: luz ×0,5 por 5 s': a luz muda e volta, e a lista conta a frase", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await acenderTocha(p);
  await expect.poll(async () => (await luzDe(p, "tocha-a"))?.claraM).toBeGreaterThan(0);
  const cheio = (await luzDe(p, "tocha-a")) as { claraM: number };

  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-vazia")).toBeVisible();
  await p.getByTestId("auto-nova").click();
  await expect(p.getByTestId("ed-raiz")).toBeVisible();
  await p.getByTestId("ed-nome").fill("Pisca");
  // o gatilho já está escolhido (a cada 60 s): muda para 10 s
  await p.getByTestId("ed-campo-cada").fill("10");
  // para cada objeto aceso, dentro do corpo: luz ×0,5 por 5 s
  await p.getByTestId("ed-mais-t0-0").click();
  await p.getByTestId("ed-menu-t0-0-paraCada").click();
  await p.getByTestId("ed-mais-t0-b0-corpo-0").click();
  await p.getByTestId("ed-menu-t0-b0-corpo-0-luz").click();
  await p.getByTestId("ed-campo-por").fill("5");
  await expect(p.getByTestId("ed-frase")).toContainText(
    "A cada 10 s: cada objeto de luz aceso fica com metade da luz por 5 s.",
  );
  await p.getByTestId("ed-salvar").click();

  await expect(p.getByTestId("auto-item-pisca")).toBeVisible();
  await expect(p.getByTestId("auto-frase-pisca")).toContainText("A cada 10 s");
  await expect(p.getByTestId("auto-gatilho-pisca")).toContainText("A cada 10 s");
  // a luz muda na hora e volta quando o prazo de 5 s acaba
  await expect
    .poll(async () => (await luzDe(p, "tocha-a"))?.claraM)
    .toBeCloseTo(cheio.claraM * 0.5, 5);
  await adiantar(request, 6_000);
  await expect.poll(async () => (await luzDe(p, "tocha-a"))?.claraM).toBeCloseTo(cheio.claraM, 5);
  // e dispara de novo no período seguinte
  await adiantar(request, 5_000);
  await expect
    .poll(async () => (await luzDe(p, "tocha-a"))?.claraM)
    .toBeCloseTo(cheio.claraM * 0.5, 5);
});

test("armadilha de zona: o token entra e a ação acontece (feita pelo editor, com a zona escolhida pelo nome)", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "zona.criar", {
    zona: {
      id: "z-armadilha",
      cenaId: CENA,
      nome: "Armadilha",
      pontos: [
        { x: 26.25, y: 6 },
        { x: 33, y: 6 },
        { x: 33, y: 13.5 },
        { x: 26.25, y: 13.5 },
      ],
      ativa: true,
      efeitos: {},
    },
  });
  await abrirAutomacoes(p);
  await p.getByTestId("auto-nova").click();
  await p.getByTestId("ed-nome").fill("Armadilha de espinhos");
  await p.getByTestId("ed-campo-gatilho").selectOption("zona");
  await p.getByTestId("ed-campo-zona").selectOption({ label: "Armadilha" });
  await p.getByTestId("ed-mais-t0-0").click();
  await p.getByTestId("ed-menu-t0-0-chat").click();
  await p.getByTestId("ed-campo-texto").fill("Cuidado, espinhos!");
  await expect(p.getByTestId("ed-frase")).toContainText(
    "Quando um token entra na zona Armadilha: avisa no chat: “Cuidado, espinhos!”.",
  );
  await p.getByTestId("ed-salvar").click();
  await expect(p.getByTestId("auto-item-armadilha-de-espinhos")).toBeVisible();

  // o ogro entra na zona: o aviso chega; fora dela, nada
  expect(anunciou(mestre.frames, "Cuidado, espinhos!")).toBe(false);
  await ok(p, "token.soltar", { id: "tok-ogro", x: 30, y: 10 });
  await expect.poll(() => anunciou(mestre.frames, "Cuidado, espinhos!")).toBe(true);
  await expect(p.getByTestId("auto-situacao-armadilha-de-espinhos")).toContainText("rodou há");
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

  // editar: o editor abre com o que já existe; mudar o nome e salvar
  await p.getByTestId("auto-editar-aviso").click();
  await expect(p.getByTestId("ed-nome")).toHaveValue("Aviso");
  await p.getByTestId("ed-nome").fill("Aviso novo");
  await expect(p.getByTestId("ed-desfazer")).toBeEnabled();
  await p.getByTestId("ed-salvar").click();
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

test("erro de validação no próprio bloco: nada salva, a mensagem diz o que fazer; o teclado navega e apaga", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  await p.getByTestId("auto-nova").click();
  // uma ação de luz solta (sem "para cada") e sem nome
  await p.getByTestId("ed-peca-luz").click();
  await p.getByTestId("ed-salvar").click();
  await expect(p.getByTestId("ed-erro-t0-b0")).toContainText("para cada");
  await expect(p.getByTestId("ed-aviso")).toBeVisible();
  await expect(p.getByTestId("ed-raiz")).toBeVisible();
  await expect(p.getByTestId("ed-no-t0-b0")).toHaveAttribute("aria-invalid", "true");
  // ainda no editor: nada foi salvo
  await p.getByTestId("ed-voltar").click();
  await expect(p.getByTestId("auto-vazia")).toBeVisible();

  // o teclado: setas navegam entre os blocos e Delete apaga o escolhido
  await p.getByTestId("auto-nova").click();
  await p.getByTestId("ed-peca-esperar").click();
  await p.getByTestId("ed-peca-chat").click();
  await expect(p.getByTestId("ed-no-t0-b1")).toHaveAttribute("aria-pressed", "true");
  await p.getByTestId("ed-no-t0-b1").focus();
  await p.keyboard.press("ArrowLeft");
  await expect(p.getByTestId("ed-no-t0-b0")).toHaveAttribute("aria-pressed", "true");
  await p.keyboard.press("Delete");
  await expect(p.getByTestId("ed-no-t0-b1")).toHaveCount(0);
  await expect(p.getByTestId("ed-no-t0-b0")).toContainText("Avisar no chat");
  // desfazer traz o bloco de volta
  await p.getByTestId("ed-desfazer").click();
  await expect(p.getByTestId("ed-no-t0-b1")).toBeVisible();
});

test("o editor numa janela própria do navegador: abre, edita, salva e fecha", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", { fluxo: fluxoDeBotao("aviso", "Aviso", "oi") });
  await abrirAutomacoes(p);
  await p.getByTestId("auto-editar-aviso").click();
  const [popup] = await Promise.all([p.waitForEvent("popup"), p.getByTestId("ed-janela").click()]);
  await expect(popup.getByTestId("automacao-propria-pagina")).toBeVisible();
  await expect(popup.getByTestId("ed-nome")).toHaveValue("Aviso");
  await expect(popup.getByTestId("ed-janela")).toHaveCount(0);
  await popup.getByTestId("ed-nome").fill("Aviso da janela");
  await Promise.all([popup.waitForEvent("close"), popup.getByTestId("ed-salvar").click()]);
  // a mesa principal tem o nome novo
  await expect(p.getByTestId("auto-nome-aviso")).toHaveText("Aviso da janela");
});

test("a Chama Primordial importada: a forma antiga vira fluxos, com a frase em português na lista", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAba(p, "mesa");
  await importarCampanha(p, {
    name: "chama-primordial.json",
    mimeType: "application/json",
    buffer: readFileSync(
      new URL("../../fixtures/campanhas/chama-primordial.json", import.meta.url),
    ),
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
  // abrir o editor de uma convertida mostra os blocos (para cada tocha, luz, sortear...)
  await p.getByTestId("auto-editar-rx-tocha-inspiracao").click();
  await expect(p.getByTestId("ed-no-gatilho")).toContainText("Sinal “inspiracao”");
  await expect(p.getByTestId("ed-no-t0-b0")).toContainText("Para cada objeto");
  await expect(p.getByTestId("ed-frase")).toContainText("30% de chance de apagar");
});
