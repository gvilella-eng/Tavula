import type { APIRequestContext, Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// AU2: as automações como o n8n. O editor SEMPRE numa janela própria do navegador (a principal nunca o mostra), a grade livre
// (arrastar a peça, ligar fios, mover, apagar, caixa de seleção, copiar e colar, zoom), as portas lógicas, o OU de gatilhos e a
// mesa de eventos (só botões, nos três modos).

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

type Aviso = { tipo?: string; texto?: string };
const avisosDe = (frames: string[]): string[] => {
  const textos: string[] = [];
  for (const f of frames) {
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
      for (const x of avisos) if (x?.tipo === "aviso" && x.texto) textos.push(x.texto);
    } catch {
      // frame que não é JSON de evento
    }
  }
  return textos;
};
const anunciou = (frames: string[], texto: string) => avisosDe(frames).includes(texto);
/** Quantas mensagens de aviso com este texto chegaram como evento (o snapshot repete o chat inteiro, então ele não conta). */
const vezesQueAnunciou = (frames: string[], texto: string) => {
  const ids = new Set<string>();
  for (const f of frames) {
    try {
      const m = JSON.parse(f) as {
        tipo: string;
        dados: {
          tipo?: string;
          dados?: { mensagem?: { id?: string; texto?: string; tipo?: string } };
        };
      };
      const msg = m.dados.dados?.mensagem;
      if (m.tipo === "evento" && m.dados.tipo === "chat.mensagem" && msg?.texto === texto) {
        ids.add(msg.id ?? f);
      }
    } catch {
      // frame que não é JSON de evento
    }
  }
  return ids.size;
};
async function abrirAutomacoes(p: Page) {
  await p.getByTestId("menu-automacoes").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
}

/** Clica num botão da lista e pega a janela nova do navegador que ele abre. */
async function abrirEditor(p: Page, testid: string): Promise<Page> {
  const [popup] = await Promise.all([p.waitForEvent("popup"), p.getByTestId(testid).click()]);
  await expect(popup.getByTestId("ed-raiz")).toBeVisible();
  return popup;
}

const anuncio = (texto: string) => ({ bloco: "acao", acao: { acao: "chat.anunciar", texto } });
const fluxoDeBotao = (id: string, nome: string, texto: string, extra: object = {}) => ({
  id,
  nome,
  gatilho: { tipo: "botao", nome, ...extra },
  trilhas: [[anuncio(texto)]],
});

async function centroDe(p: Page, testid: string) {
  const caixa = await p.getByTestId(testid).boundingBox();
  if (!caixa) throw new Error(`sem caixa para ${testid}`);
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
}

/** Arrasta um fio da saída de um nó até a entrada de outro, com o mouse. */
async function ligar(p: Page, de: string, saida: string, para: string, entrada: string) {
  const a = await centroDe(p, `ed-porta-${de}-${saida}`);
  const b = await centroDe(p, `ed-porta-${para}-${entrada}`);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await p.mouse.move(b.x, b.y, { steps: 6 });
  await p.mouse.up();
}

const fio = (p: Page, de: string, para: string) =>
  p.locator(`[data-testid^="ed-fio-"][data-de="${de}"][data-para="${para}"]`);

/** Arrasta uma peça da paleta e solta na grade, em (dx, dy) do canto de cima da grade. */
async function soltarPeca(p: Page, peca: string, dx: number, dy: number) {
  const grade = await p.getByTestId("ed-canvas").boundingBox();
  if (!grade) throw new Error("sem grade");
  await p.getByTestId(`ed-peca-${peca}`).dragTo(p.getByTestId("ed-canvas"), {
    targetPosition: { x: dx, y: dy },
  });
}

test("Editar e + Nova automação abrem o editor numa janela nova, na hora; a janela principal nunca o mostra", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", { fluxo: fluxoDeBotao("aviso", "Aviso", "oi") });
  await abrirAutomacoes(p);

  // "Editar": o editor nasce numa janela do navegador, com o que já existe
  const popup = await abrirEditor(p, "auto-editar-aviso");
  await expect(popup.getByTestId("automacao-propria-pagina")).toBeVisible();
  await expect(popup.getByTestId("ed-nome")).toHaveValue("Aviso");
  // a mesa principal não tem editor nenhum, nem janela de edição dentro da janela Automações
  await expect(p.getByTestId("ed-raiz")).toHaveCount(0);
  await expect(p.getByTestId("automacoes-lista")).toBeVisible();
  await expect(p.getByTestId("ed-janela")).toHaveCount(0);

  // clicar de novo no mesmo "Editar" só traz a janela para a frente: não abre outra e não recarrega
  await popup.getByTestId("ed-nome").fill("Aviso (mexido)");
  const paginasAntes = p.context().pages().length;
  await p.getByTestId("auto-editar-aviso").click();
  await p.waitForTimeout(300);
  expect(p.context().pages().length).toBe(paginasAntes);
  await expect(popup.getByTestId("ed-nome")).toHaveValue("Aviso (mexido)");

  // salvar fecha a janela e o nome novo está na lista da principal
  await Promise.all([popup.waitForEvent("close"), popup.getByTestId("ed-salvar").click()]);
  await expect(p.getByTestId("auto-nome-aviso")).toHaveText("Aviso (mexido)");

  // "+ Nova automação" também abre uma janela própria
  const nova = await abrirEditor(p, "auto-nova");
  await expect(nova.getByTestId("ed-nome")).toHaveValue("");
  await expect(nova.getByTestId("ed-no-n1")).toBeVisible();
  await expect(p.getByTestId("ed-raiz")).toHaveCount(0);
  await nova.close();
});

test("montar do zero, só arrastando: a peça cai onde foi solta, os fios ligam, o nó se move, o fio se apaga", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.setViewportSize({ width: 1400, height: 800 });
  await e.getByTestId("ed-nome").fill("Montada");
  // o gatilho vira botão pelo painel (o primeiro nó já está escolhido ao clicar nele)
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-gatilho").selectOption("botao");

  // arrasta a peça "Avisar no chat" da paleta para a grade: ela vira o nó n2, onde soltou
  await soltarPeca(e, "chat", 560, 260);
  const n2 = e.getByTestId("ed-no-n2");
  await expect(n2).toBeVisible();
  const grade = await e.getByTestId("ed-canvas").boundingBox();
  const caixa2 = await n2.boundingBox();
  if (!grade || !caixa2) throw new Error("sem caixas");
  expect(Math.abs(caixa2.x + caixa2.width / 2 - (grade.x + 560))).toBeLessThan(30);
  expect(Math.abs(caixa2.y + 30 - (grade.y + 260))).toBeLessThan(30);
  await e.getByTestId("ed-campo-texto").fill("Montei arrastando");

  // liga o gatilho ao chat com o mouse
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(0);
  await ligar(e, "n1", "saida", "n2", "entrada");
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(1);
  await expect(e.getByTestId("ed-frase")).toContainText("Montei arrastando");

  // mover um nó: arrastar pelo corpo desloca o nó e o fio acompanha
  const antes = await e.getByTestId("ed-no-n2").boundingBox();
  if (!antes) throw new Error("sem caixa");
  await e.mouse.move(antes.x + 60, antes.y + 22);
  await e.mouse.down();
  await e.mouse.move(antes.x + 60 + 40, antes.y + 22 + 60, { steps: 6 });
  await e.mouse.move(antes.x + 60 + 80, antes.y + 22 + 120, { steps: 6 });
  await e.mouse.up();
  const depois = await e.getByTestId("ed-no-n2").boundingBox();
  if (!depois) throw new Error("sem caixa");
  expect(Math.abs(depois.x - antes.x - 80)).toBeLessThan(6);
  expect(Math.abs(depois.y - antes.y - 120)).toBeLessThan(6);
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(1);

  // ligar uma saída numa entrada do tipo errado é recusado com o motivo
  await soltarPeca(e, "chance", 300, 420);
  await ligar(e, "n1", "saida", "n3", "valor"); // "valor" é saída: sem entrada com esse id, nada liga
  await expect(fio(e, "n1.saida", "n3.valor")).toHaveCount(0);

  // apagar o fio: clica nele (no meio do caminho) e Delete
  const a = await centroDe(e, "ed-porta-n1-saida");
  const b = await centroDe(e, "ed-porta-n2-entrada");
  await e.mouse.click((a.x + b.x) / 2, (a.y + b.y) / 2);
  await expect(e.getByTestId("ed-painel-fio")).toBeVisible();
  await e.keyboard.press("Delete");
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(0);
  // desfazer traz o fio de volta
  await e.getByTestId("ed-desfazer").click();
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(1);

  // salva (o chance solto reclama: apaga e salva)
  await e.getByTestId("ed-salvar").click();
  await expect(e.getByTestId("ed-erro-n3")).toContainText("Ligue esta condição");
  await e.getByTestId("ed-no-n3").click();
  await e.keyboard.press("Delete");
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);
  await expect(p.getByTestId("auto-frase-montada")).toContainText("Montei arrastando");

  // a automação roda de verdade: Disparar agora
  await p.getByTestId("auto-disparar-montada").click();
  await expect.poll(() => anunciou(mestre.frames, "Montei arrastando")).toBe(true);
});

// AU3: a porta NÃO virou uma caixa; a condição entra nela arrastando e a saída da caixa liga na entrada de condição do "se".
test("caixa NÃO num se: NÃO(chance 100%) manda para o caminho do não", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.setViewportSize({ width: 1500, height: 820 });
  await e.getByTestId("ed-nome").fill("Lógica");
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-gatilho").selectOption("botao");
  // as peças, soltas em lugares diferentes da grade
  await soltarPeca(e, "se", 330, 90); // n2
  await soltarPeca(e, "nao", 560, 330); // n3: a caixa NÃO
  await e.getByTestId("ed-peca-chance").dragTo(e.getByTestId("ed-no-n3")); // n4: a chance, solta dentro da caixa
  await soltarPeca(e, "chat", 780, 70); // n5
  await soltarPeca(e, "chat", 780, 220); // n6
  await expect(e.locator('[data-testid="ed-no-n3"] [data-testid="ed-no-n4"]')).toHaveCount(1);
  await e.getByTestId("ed-no-n4").click();
  await e.getByTestId("ed-campo-chance").fill("100");
  await e.getByTestId("ed-no-n5").click();
  await e.getByTestId("ed-campo-texto").fill("caminho do sim");
  await e.getByTestId("ed-no-n6").click();
  await e.getByTestId("ed-campo-texto").fill("caminho do nao");

  await ligar(e, "n1", "saida", "n2", "entrada");
  await ligar(e, "n3", "saida", "n2", "condicao");
  await ligar(e, "n2", "sim", "n5", "entrada");
  await ligar(e, "n2", "nao", "n6", "entrada");
  await expect(e.locator('[data-testid^="ed-fio-"]')).toHaveCount(4);
  // fio de condição e fio de ordem têm aparência diferente
  await expect(e.locator('[data-testid^="ed-fio-"][data-tipo-fio="valor"]')).toHaveCount(1);
  await expect(e.getByTestId("ed-frase")).toContainText("NÃO");
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);

  await p.getByTestId("auto-disparar-logica").click();
  await expect.poll(() => anunciou(mestre.frames, "caminho do nao")).toBe(true);
  expect(anunciou(mestre.frames, "caminho do sim")).toBe(false);
});

// AU3: dois gatilhos ligados ao mesmo bloco (o AU2) viram uma caixa QUALQUER UM com os dois dentro.
test("dois gatilhos em OU disparam pelos dois; o editor mostra os dois dentro de uma caixa ligada ao bloco", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const botaoQueManda = (id: string, sinal: string) => ({
    id,
    nome: id,
    gatilho: { tipo: "botao", nome: id },
    trilhas: [[{ bloco: "sinal", nome: sinal }]],
  });
  await ok(p, "fluxo.criar", { fluxo: botaoQueManda("um", "A") });
  await ok(p, "fluxo.criar", { fluxo: botaoQueManda("dois", "B") });
  await ok(p, "fluxo.criar", {
    fluxo: {
      id: "ou",
      nome: "Ou",
      cenas: null,
      ligado: true,
      nos: [
        { id: "ga", tipo: "gatilho", x: 60, y: 40, config: { tipo: "sinal", nome: "A" } },
        { id: "gb", tipo: "gatilho", x: 60, y: 160, config: { tipo: "sinal", nome: "B" } },
        {
          id: "av",
          tipo: "acao",
          x: 340,
          y: 100,
          config: { acao: { acao: "chat.anunciar", texto: "um dos dois" } },
        },
      ],
      fios: [
        { de: { no: "ga", saida: "saida" }, para: { no: "av", entrada: "entrada" } },
        { de: { no: "gb", saida: "saida" }, para: { no: "av", entrada: "entrada" } },
      ],
    },
  });
  await ok(p, "botao.usar", { botaoId: "evento:um" });
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "um dos dois")).toBe(1);
  await ok(p, "botao.usar", { botaoId: "evento:dois" });
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "um dos dois")).toBe(2);

  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-frase-ou")).toContainText(
    "qualquer um destes acontecer (ao receber o sinal “A”, ou ao receber o sinal “B”)",
  );
  const e = await abrirEditor(p, "auto-editar-ou");
  await expect(e.locator('[data-testid^="ed-no-"][data-tipo="gatilho"]')).toHaveCount(2);
  await expect(e.locator('[data-testid^="ed-no-"][data-tipo="caixa"]')).toHaveCount(1);
  // os dois gatilhos estão dentro da caixa, e é a caixa que se liga ao bloco (um fio só)
  await expect(
    e.locator(
      '[data-tipo="caixa"] [data-testid="ed-no-ga"], [data-tipo="caixa"] [data-testid="ed-no-gb"]',
    ),
  ).toHaveCount(2);
  await expect(e.locator('[data-testid^="ed-fio-"][data-para="av.entrada"]')).toHaveCount(1);
  await e.close();
});

test("a grade: zoom, mover a vista, caixa de seleção, copiar e colar, busca, teclado e o menu Ligar a…", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.setViewportSize({ width: 1400, height: 800 });

  // clicar nas peças põe nós no meio da tela
  await e.getByTestId("ed-peca-esperar").click();
  await e.getByTestId("ed-peca-chat").click();
  await expect(e.getByTestId("ed-no-n2")).toBeVisible();
  await expect(e.getByTestId("ed-no-n3")).toBeVisible();

  // duplo clique na grade abre a busca de peças ali; Enter põe a primeira que casa
  const grade = await e.getByTestId("ed-canvas").boundingBox();
  if (!grade) throw new Error("sem grade");
  await e.mouse.dblclick(grade.x + 700, grade.y + 120);
  await expect(e.getByTestId("ed-busca")).toBeVisible();
  await e.getByTestId("ed-busca-campo").fill("sinal");
  await e.keyboard.press("Enter");
  await expect(e.getByTestId("ed-busca")).toHaveCount(0);
  await expect(e.getByTestId("ed-no-n4")).toBeVisible();

  // zoom com a roda e mover a vista arrastando o fundo
  const zoom0 = Number(await e.getByTestId("ed-canvas").getAttribute("data-zoom"));
  await e.mouse.move(grade.x + 400, grade.y + 300);
  await e.mouse.wheel(0, -300);
  await expect
    .poll(async () => Number(await e.getByTestId("ed-canvas").getAttribute("data-zoom")))
    .toBeGreaterThan(zoom0);
  const nAntes = await e.getByTestId("ed-no-n1").boundingBox();
  await e.mouse.move(grade.x + grade.width - 90, grade.y + grade.height - 30);
  await e.mouse.down();
  await e.mouse.move(grade.x + grade.width - 140, grade.y + grade.height - 30, { steps: 5 });
  await e.mouse.up();
  const nDepois = await e.getByTestId("ed-no-n1").boundingBox();
  expect(nAntes && nDepois && Math.abs(nDepois.x - nAntes.x + 50) < 4).toBe(true);
  await e.getByTestId("ed-zoom-ajustar").click();

  // seleção por caixa (Shift + arrastar no fundo) e mover juntos
  const g2 = await e.getByTestId("ed-canvas").boundingBox();
  if (!g2) throw new Error("sem grade");
  await e.keyboard.down("Shift");
  await e.mouse.move(g2.x + 4, g2.y + 4);
  await e.mouse.down();
  await e.mouse.move(g2.x + g2.width - 4, g2.y + g2.height - 4, { steps: 8 });
  await e.mouse.up();
  await e.keyboard.up("Shift");
  await expect(e.getByTestId("ed-painel-varios")).toContainText("4 blocos");

  // copiar e colar: os quatro ganham cópias
  await e.keyboard.press("Control+c");
  await e.keyboard.press("Control+v");
  await expect(e.locator('[data-testid^="ed-no-"][data-no-id]')).toHaveCount(8);
  await e.keyboard.press("Control+z");
  await expect(e.locator('[data-testid^="ed-no-"][data-no-id]')).toHaveCount(4);

  // teclado: Tab chega aos nós, as setas movem o nó, Enter vai para os campos
  const x0 = (await e.getByTestId("ed-no-n3").boundingBox())?.x ?? 0;
  await e.getByTestId("ed-no-n3").click();
  await e.getByTestId("ed-no-n3").press("ArrowRight");
  await e.getByTestId("ed-no-n3").press("ArrowRight");
  await expect
    .poll(async () => ((await e.getByTestId("ed-no-n3").boundingBox())?.x ?? 0) - x0)
    .toBeGreaterThan(5);

  // "Ligar a…": sem mouse. O gatilho (n1) liga ao "Esperar" (n2) e este ao chat (n3)
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-ligar-a").click();
  await e.getByTestId("ed-ligar-saida-n2-entrada").click();
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(1);
  await e.getByTestId("ed-no-n2").click();
  await e.getByTestId("ed-ligar-a").click();
  await e.getByTestId("ed-ligar-saida-n3-entrada").click();
  await expect(fio(e, "n2.saida", "n3.entrada")).toHaveCount(1);
  await e.close();
});

test("o editor mostra o erro no próprio nó e nada salva; ciclo sem esperar é recusado", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  // uma ação de luz solta, sem "para cada", sem nome
  await e.getByTestId("ed-peca-luz").click();
  await e.getByTestId("ed-salvar").click();
  await expect(e.getByTestId("ed-erro-n2")).toContainText("nenhum gatilho");
  await expect(e.getByTestId("ed-no-n2")).toHaveAttribute("aria-invalid", "true");
  await expect(e.getByTestId("ed-aviso")).toBeVisible();
  // ligar o gatilho ao bloco: agora o erro é o da luz sem "para cada"
  await ligar(e, "n1", "saida", "n2", "entrada");
  await e.getByTestId("ed-salvar").click();
  await expect(e.getByTestId("ed-erro-n2")).toContainText("para cada");

  // ciclo sem esperar: duas ações ligadas uma na outra
  await e.getByTestId("ed-peca-chat").click(); // n3
  await e.getByTestId("ed-peca-chat").click(); // n4
  await ligar(e, "n3", "saida", "n4", "entrada");
  await ligar(e, "n4", "saida", "n3", "entrada");
  await ligar(e, "n1", "saida", "n3", "entrada");
  await e.getByTestId("ed-salvar").click();
  await expect(e.getByTestId("ed-erro-n3")).toContainText("ciclo sem pausa");
  await e.close();
  // nada foi salvo
  await expect(p.getByTestId("auto-vazia")).toBeVisible();
});

test("a mesa de eventos: só os botões das automações de botão, com nome, cor e ícone; clicar dispara", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", {
    fluxo: fluxoDeBotao("trovao", "Trovão", "Troveja!", { cor: "azul", icone: "trovao" }),
  });
  await ok(p, "fluxo.criar", { fluxo: fluxoDeBotao("sino", "Sino", "Dlin dlon") });
  await ok(p, "fluxo.criar", {
    fluxo: {
      id: "relogio-so",
      nome: "Só relógio",
      gatilho: { tipo: "relogio", cadaS: 600 },
      trilhas: [[anuncio("tic")]],
    },
  });
  await ok(p, "fluxo.ligar", { id: "sino", ligado: false });

  await abrirAutomacoes(p);
  await p.getByTestId("auto-abrir-mesa-de-eventos").click();
  await expect(p.getByTestId("painel-eventos")).toBeVisible();
  // só os dois botões (o relógio não vira botão)
  await expect(p.getByTestId("evento-botao-trovao")).toBeVisible();
  await expect(p.getByTestId("evento-botao-sino")).toBeVisible();
  await expect(p.getByTestId("evento-botao-relogio-so")).toHaveCount(0);
  await expect(p.getByTestId("evento-botao-trovao")).toContainText("Trovão");
  await expect(p.getByTestId("evento-estado-trovao")).toHaveText("Ligada");
  await expect(p.getByTestId("evento-estado-sino")).toHaveText("Desligada");

  // clicar dispara, com o retorno rápido ("Disparou")
  await p.getByTestId("evento-botao-trovao").click();
  await expect(p.getByTestId("evento-estado-trovao")).toHaveText("Disparou");
  await expect.poll(() => anunciou(mestre.frames, "Troveja!")).toBe(true);
  await expect(p.getByTestId("evento-estado-trovao")).toHaveText("Ligada");

  // os mesmos modos da mesa de som: faixa no pé da tela...
  await p.getByTestId("eventos-encaixar").click();
  await expect(p.getByTestId("eventos-faixa")).toBeVisible();
  await expect(p.getByTestId("painel-eventos")).toHaveCount(0);
  await expect(p.getByTestId("eventos-resumo")).toHaveText("2 botões");
  // ...e janela própria do navegador
  const [popup] = await Promise.all([
    p.waitForEvent("popup"),
    p.getByTestId("eventos-abrir-em-janela").click(),
  ]);
  await expect(popup.getByTestId("eventos-propria")).toBeVisible();
  await expect(popup.getByTestId("evento-botao-trovao")).toBeVisible();
  await popup.getByTestId("evento-botao-trovao").click();
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "Troveja!")).toBe(2);
  await popup.close();
  await p.getByTestId("eventos-soltar").click();
  await expect(p.getByTestId("painel-eventos")).toBeVisible();
});

test("a mesa de eventos do jogador só tem os botões que o mestre liberou, e a definição não chega a ele", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "fluxo.criar", {
    fluxo: fluxoDeBotao("soprar", "Soprar", "O vento sopra", { cor: "verde", icone: "vento" }),
  });
  await ok(p, "fluxo.criar", { fluxo: fluxoDeBotao("segredo", "Segredo", "SEGREDO-DO-MESTRE") });
  await ok(p, "fluxo.editar", { id: "soprar", mudancas: { liberadoParaJogadores: true } });

  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await j1.pagina.getByTestId("abrir-mesa-de-eventos").click();
  await expect(j1.pagina.getByTestId("painel-eventos")).toBeVisible();
  await expect(j1.pagina.getByTestId("evento-botao-soprar")).toBeVisible();
  await expect(j1.pagina.getByTestId("evento-botao-segredo")).toHaveCount(0);
  await j1.pagina.getByTestId("evento-botao-soprar").click();
  await expect.poll(() => anunciou(j1.frames, "O vento sopra")).toBe(true);
  expect(j1.frames.join("\n")).not.toContain("SEGREDO-DO-MESTRE");
  expect(j1.frames.join("\n")).not.toContain('"nos"');
});

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";
const CENA = "cena-1";

const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const luzDe = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id);

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

test("criar pelo editor 'a cada 10 s: luz ×0,5 por 5 s': a luz muda e volta, e a lista conta a frase", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-a" });
  await expect.poll(async () => (await luzDe(p, "tocha-a"))?.claraM).toBeGreaterThan(0);
  const cheio = (await luzDe(p, "tocha-a")) as { claraM: number };

  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-vazia")).toBeVisible();
  const e = await abrirEditor(p, "auto-nova");
  await e.setViewportSize({ width: 1400, height: 800 });
  await e.getByTestId("ed-nome").fill("Pisca");
  // o gatilho já está na grade (a cada 60 s): muda para 10 s
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-cada").fill("10");
  // para cada objeto aceso, e dentro dele: luz ×0,5 por 5 s
  await e.getByTestId("ed-peca-paraCada").click();
  await e.getByTestId("ed-peca-luz").click();
  await ligar(e, "n1", "saida", "n2", "entrada");
  await ligar(e, "n2", "corpo", "n3", "entrada");
  await e.getByTestId("ed-no-n3").click();
  await e.getByTestId("ed-campo-por").fill("5");
  await expect(e.getByTestId("ed-frase")).toContainText(
    "A cada 10 s: cada objeto de luz aceso fica com metade da luz por 5 s.",
  );
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);

  await expect(p.getByTestId("auto-item-pisca")).toBeVisible();
  await expect(p.getByTestId("auto-frase-pisca")).toContainText("A cada 10 s");
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
  const e = await abrirEditor(p, "auto-nova");
  await e.setViewportSize({ width: 1400, height: 800 });
  await e.getByTestId("ed-nome").fill("Armadilha de espinhos");
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-gatilho").selectOption("zona");
  await e.getByTestId("ed-campo-zona").selectOption({ label: "Armadilha" });
  await e.getByTestId("ed-peca-chat").click();
  await e.getByTestId("ed-campo-texto").fill("Cuidado, espinhos!");
  await ligar(e, "n1", "saida", "n2", "entrada");
  await expect(e.getByTestId("ed-frase")).toContainText(
    "Quando um token entra na zona Armadilha: avisa no chat: “Cuidado, espinhos!”.",
  );
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);
  await expect(p.getByTestId("auto-item-armadilha-de-espinhos")).toBeVisible();

  // o ogro entra na zona: o aviso chega; fora dela, nada
  expect(anunciou(mestre.frames, "Cuidado, espinhos!")).toBe(false);
  await ok(p, "token.soltar", { id: "tok-ogro", x: 30, y: 10 });
  await expect.poll(() => anunciou(mestre.frames, "Cuidado, espinhos!")).toBe(true);
  await expect(p.getByTestId("auto-situacao-armadilha-de-espinhos")).toContainText("rodou há");
});
