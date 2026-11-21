import type { APIRequestContext, Page } from "@playwright/test";
import {
  CAMINHO_DA_MESA,
  enviarCru,
  esperarMapa,
  expect,
  intencaoCrua,
  type Mesa,
  test,
} from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";

// AU3: as portas lógicas viram CAIXAS na grade (QUALQUER UM, TODAS, NÃO) com gatilhos e condições dentro, e o tour do centro de
// automações (as peças, a mesa de eventos e a montagem de "as tochas têm 30% de chance de apagar a cada 3 minutos").

test.describe.configure({ timeout: 120_000 });

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

/** Quantas mensagens de aviso com este texto chegaram como evento de chat. */
const vezesQueAnunciou = (frames: string[], texto: string) => {
  const ids = new Set<string>();
  for (const f of frames) {
    try {
      const m = JSON.parse(f) as {
        tipo: string;
        dados: { tipo?: string; dados?: { mensagem?: { id?: string; texto?: string } } };
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

async function abrirEditor(p: Page, testid: string): Promise<Page> {
  const [popup] = await Promise.all([p.waitForEvent("popup"), p.getByTestId(testid).click()]);
  await expect(popup.getByTestId("ed-raiz")).toBeVisible();
  await popup.setViewportSize({ width: 1500, height: 860 });
  return popup;
}

async function centroDe(p: Page, testid: string) {
  const caixa = await p.getByTestId(testid).boundingBox();
  if (!caixa) throw new Error(`sem caixa para ${testid}`);
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
}

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

/** Os espaços e o pé com o "+" ficam dentro da borda da caixa (a altura que a caixa conta bate com o desenho). */
async function esperarTudoDentroDaCaixa(p: Page, caixa: string) {
  const borda = await p.getByTestId(`ed-no-${caixa}`).boundingBox();
  if (!borda) throw new Error(`sem caixa ${caixa}`);
  const partes = p.locator(`[data-espaco-de="${caixa}"], [data-fim-de="${caixa}"]`);
  const n = await partes.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) {
    const r = await partes.nth(i).boundingBox();
    if (!r) throw new Error(`parte ${i} da caixa ${caixa} sem medida`);
    expect(r.y, `parte ${i} da caixa ${caixa}`).toBeGreaterThanOrEqual(borda.y - 1);
    expect(r.y + r.height, `parte ${i} da caixa ${caixa}`).toBeLessThanOrEqual(
      borda.y + borda.height + 1,
    );
  }
}

/** Arrasta uma peça da paleta e solta na grade, em (dx, dy) do canto de cima da grade. */
async function soltarPeca(p: Page, peca: string, dx: number, dy: number) {
  await p.getByTestId(`ed-peca-${peca}`).dragTo(p.getByTestId("ed-canvas"), {
    targetPosition: { x: dx, y: dy },
  });
}

/** Arrasta uma peça da paleta e solta DENTRO de um espaço de uma caixa da grade. */
async function soltarPecaNoEspaco(p: Page, peca: string, caixa: string, espaco: number) {
  await p.getByTestId(`ed-peca-${peca}`).dragTo(p.getByTestId(`ed-espaco-${caixa}-${espaco}`));
}

/** Arrasta um nó da grade com o mouse até o centro de outro nó (ou até um ponto da grade), e solta (ou fica segurando). */
async function arrastarNo(
  p: Page,
  no: string,
  destino: { testid: string } | { x: number; y: number },
  soltar = true,
) {
  const a = await centroDe(p, `ed-no-${no}`);
  const b = "testid" in destino ? await centroDe(p, destino.testid) : destino;
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(a.x + 12, a.y + 12, { steps: 3 });
  await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await p.mouse.move(b.x, b.y, { steps: 8 });
  if (soltar) await p.mouse.up();
}

const pontoDaGrade = async (p: Page, dx: number, dy: number) => {
  const g = await p.getByTestId("ed-canvas").boundingBox();
  if (!g) throw new Error("sem grade");
  return { x: g.x + dx, y: g.y + dy };
};

// ---------------------------------------------------------------------------------------------------------------------
// As caixas
// ---------------------------------------------------------------------------------------------------------------------

const espaco = (caixa: string, i: number) => `ed-espaco-${caixa}-${i}`;
const dentroDe = (p: Page, caixa: string, i: number, no: string) =>
  p.locator(`[data-testid="${espaco(caixa, i)}"] [data-testid="ed-no-${no}"]`);
const numeroDeEspacos = async (p: Page, caixa: string) =>
  Number(await p.getByTestId(`ed-no-${caixa}`).getAttribute("data-espacos"));

test("arrastar dois gatilhos para uma caixa OU e disparar pelos dois", async ({ mesa }) => {
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

  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.getByTestId("ed-nome").fill("Ouvinte");
  // o primeiro gatilho (n1) ouve o sinal A
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-gatilho").selectOption("sinal");
  await e.getByTestId("ed-campo-sinal").fill("A");
  // a caixa OU entra na grade (n2), já com dois espaços vazios, e o gatilho n1 é arrastado para o de cima
  await soltarPeca(e, "ou", 520, 260);
  await expect(e.getByTestId("ed-no-n2")).toHaveAttribute("data-tipo", "caixa");
  expect(await numeroDeEspacos(e, "n2")).toBe(2);
  await expect(e.getByTestId(espaco("n2", 0))).toContainText(
    "solte aqui um gatilho, uma condição, uma ação ou outra caixa",
  );
  await arrastarNo(e, "n1", { testid: espaco("n2", 0) });
  await expect(dentroDe(e, "n2", 0, "n1")).toHaveCount(1);
  // o segundo gatilho vem da paleta, direto para o espaço de baixo (n3), e ouve o sinal B
  await soltarPecaNoEspaco(e, "sinal", "n2", 1);
  await expect(dentroDe(e, "n2", 1, "n3")).toHaveCount(1);
  await e.getByTestId("ed-campo-sinal").fill("B");
  // o que acontece: um aviso, ligado pela saída da caixa
  await soltarPeca(e, "chat", 900, 200); // n4
  await e.getByTestId("ed-campo-texto").fill("um dos dois");
  await ligar(e, "n2", "saida", "n4", "entrada");
  await expect(fio(e, "n2.saida", "n4.entrada")).toHaveCount(1);
  await expect(e.getByTestId("ed-frase")).toContainText("qualquer um destes acontecer");
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);

  await ok(p, "botao.usar", { botaoId: "evento:um" });
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "um dos dois")).toBe(1);
  await ok(p, "botao.usar", { botaoId: "evento:dois" });
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "um dos dois")).toBe(2);
});

test("montar E com um NÃO dentro, ligado ao Se, e trocar E por OU pelo rótulo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.getByTestId("ed-nome").fill("Todas");
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-gatilho").selectOption("botao");
  await soltarPeca(e, "se", 330, 90); // n2
  await soltarPeca(e, "e", 560, 300); // n3: caixa E
  await soltarPecaNoEspaco(e, "nao", "n3", 0); // n4: NÃO, dentro do espaço de cima de E
  await soltarPecaNoEspaco(e, "chance", "n4", 0); // n5: chance, dentro do NÃO
  await e.getByTestId("ed-campo-chance").fill("0");
  await soltarPecaNoEspaco(e, "chance", "n3", 1); // n6: chance, no espaço de baixo de E
  await e.getByTestId("ed-campo-chance").fill("100");
  await soltarPeca(e, "chat", 900, 70); // n7
  await e.getByTestId("ed-campo-texto").fill("caminho do sim");
  await soltarPeca(e, "chat", 900, 200); // n8
  await e.getByTestId("ed-campo-texto").fill("caminho do nao");
  // a caixa NÃO está dentro do espaço de cima de E, e a chance de 0% dentro do NÃO
  await expect(dentroDe(e, "n3", 0, "n4")).toHaveCount(1);
  await expect(dentroDe(e, "n4", 0, "n5")).toHaveCount(1);
  await expect(dentroDe(e, "n3", 1, "n6")).toHaveCount(1);
  await expect(e.getByTestId("ed-no-n3")).toHaveAttribute("data-logica", "e");

  await ligar(e, "n1", "saida", "n2", "entrada");
  await ligar(e, "n3", "saida", "n2", "condicao");
  await ligar(e, "n2", "sim", "n7", "entrada");
  await ligar(e, "n2", "nao", "n8", "entrada");
  await expect(e.locator('[data-testid^="ed-fio-"]')).toHaveCount(4);
  await expect(e.getByTestId("ed-frase")).toContainText("(NÃO o sorteio de 0% der certo");
  await expect(e.getByTestId("ed-frase")).toContainText(") e o sorteio de 100%");

  // o rótulo "E" entre os espaços troca a caixa inteira por OU (e de volta)
  await expect(e.getByTestId("ed-rotulo-n3-1")).toHaveText("E");
  await e.getByTestId("ed-rotulo-n3-1").click();
  await expect(e.getByTestId("ed-rotulo-n3-1")).toHaveText("OU");
  await expect(e.getByTestId("ed-no-n3")).toHaveAttribute("data-logica", "ou");
  await expect(e.getByTestId("ed-frase")).toContainText(") ou o sorteio de 100%");
  await e.getByTestId("ed-rotulo-n3-1").click();
  await expect(e.getByTestId("ed-no-n3")).toHaveAttribute("data-logica", "e");
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);

  // NÃO(chance 0%) é verdadeiro e a chance de 100% também: E vale, vai pelo "sim"
  await p.getByTestId("auto-disparar-todas").click();
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "caminho do sim")).toBe(1);
  expect(vezesQueAnunciou(mestre.frames, "caminho do nao")).toBe(0);
});

test("a caixa cresce pelo + e arrastando para entre dois espaços, e encolhe ao tirar a peça", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await soltarPeca(e, "ou", 520, 220); // n2: nasce com 2 espaços
  expect(await numeroDeEspacos(e, "n2")).toBe(2);
  // o espaço a mais só tem × quando passa de 2
  await expect(e.getByTestId("ed-espaco-x-n2-0")).toHaveCount(0);
  // o + acrescenta um espaço no pé
  await e.getByTestId("ed-mais-n2").click();
  expect(await numeroDeEspacos(e, "n2")).toBe(3);
  await expect(e.getByTestId(espaco("n2", 2))).toBeVisible();
  // o × tira um espaço vazio a mais; o mínimo é 2
  await e.getByTestId("ed-espaco-x-n2-2").click();
  expect(await numeroDeEspacos(e, "n2")).toBe(2);
  await expect(e.getByTestId("ed-espaco-x-n2-0")).toHaveCount(0);

  // o gatilho n1 entra no espaço de cima
  await arrastarNo(e, "n1", { testid: espaco("n2", 0) });
  await expect(dentroDe(e, "n2", 0, "n1")).toHaveCount(1);
  // soltar uma peça da paleta entre os dois espaços abre um espaço novo ali: o de baixo desce
  await e
    .getByTestId("ed-peca-botao")
    .dragTo(e.locator('[data-separador-de="n2"][data-antes-de="1"]')); // n3
  expect(await numeroDeEspacos(e, "n2")).toBe(3);
  await expect(dentroDe(e, "n2", 1, "n3")).toHaveCount(1);
  await expect(e.getByTestId(espaco("n2", 2))).toHaveAttribute("data-vazio", "sim");
  // soltar logo abaixo do último espaço abre um espaço no fim
  await e.getByTestId("ed-peca-sinal").dragTo(e.locator('[data-fim-de="n2"]')); // n4
  expect(await numeroDeEspacos(e, "n2")).toBe(4);
  await expect(dentroDe(e, "n2", 3, "n4")).toHaveCount(1);
  // com três peças, o último espaço e o "+" ficam dentro da caixa (antes, cada peça empurrava uns 20 px e vazavam)
  await esperarTudoDentroDaCaixa(e, "n2");
  // tirar a peça de um espaço, numa caixa com mais de 2, remove o espaço
  await arrastarNo(e, "n4", await pontoDaGrade(e, 1000, 560));
  expect(await numeroDeEspacos(e, "n2")).toBe(3);
  await arrastarNo(e, "n3", await pontoDaGrade(e, 1000, 420));
  expect(await numeroDeEspacos(e, "n2")).toBe(2);
  await expect(dentroDe(e, "n2", 0, "n1")).toHaveCount(1);
  await expect(e.getByTestId(espaco("n2", 1))).toHaveAttribute("data-vazio", "sim");

  // o NÃO tem um espaço só e nenhum +
  await soltarPeca(e, "nao", 300, 520); // n5
  expect(await numeroDeEspacos(e, "n5")).toBe(1);
  await expect(e.getByTestId("ed-mais-n5")).toHaveCount(0);
});

test("uma caixa de três itens e caixa dentro de caixa, em qualquer espaço", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.getByTestId("ed-nome").fill("Tres");
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-campo-gatilho").selectOption("botao");
  await soltarPeca(e, "se", 330, 70); // n2
  await soltarPeca(e, "ou", 560, 230); // n3: OU com 3 espaços (pelo +)
  await e.getByTestId("ed-mais-n3").click();
  expect(await numeroDeEspacos(e, "n3")).toBe(3);
  await soltarPecaNoEspaco(e, "chance", "n3", 0); // n4
  await e.getByTestId("ed-campo-chance").fill("0");
  await soltarPecaNoEspaco(e, "e", "n3", 1); // n5: caixa E dentro do espaço do meio
  await soltarPecaNoEspaco(e, "chance", "n5", 0); // n6
  await e.getByTestId("ed-campo-chance").fill("100");
  await soltarPecaNoEspaco(e, "chance", "n5", 1); // n7
  await e.getByTestId("ed-campo-chance").fill("100");
  await soltarPecaNoEspaco(e, "chance", "n3", 2); // n8
  await e.getByTestId("ed-campo-chance").fill("0");
  await expect(dentroDe(e, "n3", 1, "n5")).toHaveCount(1);
  await expect(dentroDe(e, "n5", 1, "n7")).toHaveCount(1);
  // a caixa de fora e a de dentro cabem o que têm
  await esperarTudoDentroDaCaixa(e, "n3");
  await esperarTudoDentroDaCaixa(e, "n5");
  await soltarPeca(e, "chat", 900, 60); // n9
  await e.getByTestId("ed-campo-texto").fill("alguma valeu");
  await ligar(e, "n1", "saida", "n2", "entrada");
  await ligar(e, "n3", "saida", "n2", "condicao");
  await ligar(e, "n2", "sim", "n9", "entrada");
  await expect(e.getByTestId("ed-frase")).toContainText("ou");
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);
  // (0%) OU (100% E 100%) OU (0%) vale
  await p.getByTestId("auto-disparar-tres").click();
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "alguma valeu")).toBe(1);
});

test("tirar uma peça da caixa (arrastando e pelo menu do teclado) e subir ou descer de espaço", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await soltarPeca(e, "ou", 520, 260); // n2
  await arrastarNo(e, "n1", { testid: espaco("n2", 0) });
  await expect(dentroDe(e, "n2", 0, "n1")).toHaveCount(1);

  // arrastando para um lugar vazio da grade, a peça sai da caixa (o espaço fica vazio: a caixa tem 2)
  await arrastarNo(e, "n1", await pontoDaGrade(e, 1000, 520));
  await expect(e.locator('[data-testid="ed-no-n2"] [data-testid="ed-no-n1"]')).toHaveCount(0);
  await expect(e.getByTestId(espaco("n2", 0))).toHaveAttribute("data-vazio", "sim");
  await expect(e.getByTestId("ed-no-n1")).toBeVisible();

  // pelo teclado (menu "Caixa…"): põe no espaço 1 da caixa
  await e.getByTestId("ed-no-n1").click();
  await e.getByTestId("ed-caixa-menu").click();
  await e.getByTestId("ed-caixa-por-n2-0").click();
  await expect(dentroDe(e, "n2", 0, "n1")).toHaveCount(1);

  // uma segunda peça no espaço de baixo; "Subir um espaço" troca de lugar com a de cima
  await soltarPecaNoEspaco(e, "botao", "n2", 1); // n3
  await expect(dentroDe(e, "n2", 1, "n3")).toHaveCount(1);
  await e.getByTestId("ed-caixa-menu").click();
  await e.getByTestId("ed-caixa-subir").click();
  await expect(dentroDe(e, "n2", 0, "n3")).toHaveCount(1);
  await expect(dentroDe(e, "n2", 1, "n1")).toHaveCount(1);
  await e.getByTestId("ed-caixa-menu").click();
  await e.getByTestId("ed-caixa-descer").click();
  await expect(dentroDe(e, "n2", 1, "n3")).toHaveCount(1);

  await e.getByTestId("ed-caixa-menu").click();
  await e.getByTestId("ed-caixa-tirar").click();
  await expect(e.locator('[data-testid="ed-no-n2"] [data-testid="ed-no-n3"]')).toHaveCount(0);
  await expect(dentroDe(e, "n2", 0, "n1")).toHaveCount(1);
});

test("o que não combina é recusado ao soltar, com a dica do porquê", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await soltarPeca(e, "e", 560, 260); // n2: E
  await soltarPeca(e, "ou", 560, 520); // n3: OU
  await soltarPecaNoEspaco(e, "botao", "n2", 0); // n4: um gatilho em E
  // (a posição se mede a partir da grade: o aviso que aparece em cima empurra a tela para baixo)
  const naGrade = async () => {
    const [g, n] = await Promise.all([
      e.getByTestId("ed-canvas").boundingBox(),
      e.getByTestId("ed-no-n1").boundingBox(),
    ]);
    if (!g || !n) throw new Error("sem caixa");
    return { x: n.x - g.x, y: n.y - g.y };
  };
  const antes = await naGrade();

  // gatilho E gatilho: enquanto segura, o espaço avisa; ao soltar, o aviso fica e a peça volta ao lugar
  await arrastarNo(e, "n1", { testid: espaco("n2", 1) }, false);
  await expect(e.getByTestId("ed-solta-dica")).toContainText("use OU");
  await expect(e.getByTestId(espaco("n2", 1))).toHaveAttribute("data-solta", "recusa");
  await e.mouse.up();
  await expect(e.getByTestId("ed-aviso")).toContainText(
    "Dois acontecimentos não chegam no mesmo instante: para gatilhos, use OU.",
  );
  await expect(dentroDe(e, "n2", 1, "n1")).toHaveCount(0);
  const depois = await naGrade();
  expect(Math.abs(depois.x - antes.x)).toBeLessThan(2);
  expect(Math.abs(depois.y - antes.y)).toBeLessThan(2);

  // uma peça nova da paleta também é recusada, e não nasce peça nenhuma
  const contagem = () => e.locator('[data-testid^="ed-no-"]').count();
  const total = await contagem();
  await soltarPecaNoEspaco(e, "relogio", "n2", 1);
  await expect(e.getByTestId("ed-aviso")).toContainText("use OU");
  expect(await contagem()).toBe(total);

  // ação misturada com gatilho
  await soltarPecaNoEspaco(e, "chat", "n2", 1);
  await expect(e.getByTestId("ed-aviso")).toContainText("Uma ação não se mistura");
  expect(await contagem()).toBe(total);

  // espaço ocupado
  await soltarPecaNoEspaco(e, "chance", "n2", 0);
  await expect(e.getByTestId("ed-aviso")).toContainText("já tem uma peça");

  // os outros blocos de fluxo ficam na grade
  await soltarPecaNoEspaco(e, "esperar", "n3", 0);
  await expect(e.getByTestId("ed-aviso")).toContainText("ficam na grade");
  expect(await contagem()).toBe(total);

  // NÃO só aceita condição
  await soltarPeca(e, "nao", 300, 520); // n5
  await soltarPecaNoEspaco(e, "botao", "n5", 0);
  await expect(e.getByTestId("ed-aviso")).toContainText("NÃO nega uma condição");

  // gatilho OU condição não vale; trocar o rótulo de E para OU com gatilho e condição também não
  await soltarPecaNoEspaco(e, "chance", "n3", 0); // n6: condição no OU vazio
  await soltarPecaNoEspaco(e, "botao", "n3", 1);
  await expect(e.getByTestId("ed-aviso")).toContainText("precisa do E");
});

test("a caixa vazia, ou com espaço sem peça, aparece com o erro no próprio bloco", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.getByTestId("ed-nome").fill("Vazia");
  await soltarPeca(e, "nao", 560, 260); // n2: NÃO vazio
  await soltarPeca(e, "ou", 560, 420); // n3: OU com um espaço só preenchido
  await soltarPecaNoEspaco(e, "chance", "n3", 0);
  await e.getByTestId("ed-salvar").click();
  await expect(e.getByTestId("ed-erro-n2")).toContainText("NÃO está vazio");
  await expect(e.getByTestId("ed-erro-n3")).toContainText("Falta uma peça no espaço 2");
});

test("gatilho E condição, ação E ação e ação OU ação: o motor faz o que a caixa diz", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  const anuncio = (texto: string) => ({ acao: { acao: "chat.anunciar", texto } });
  const caixaDeBotao = (id: string, chance: number) => ({
    id,
    nome: id,
    cenas: null,
    ligado: true,
    caixas: true,
    nos: [
      { id: "c", tipo: "caixa", x: 40, y: 40, config: { porta: "e" } },
      {
        id: "b",
        tipo: "gatilho",
        x: 0,
        y: 0,
        em: "c",
        espaco: 0,
        config: { tipo: "botao", nome: id },
      },
      {
        id: "q",
        tipo: "condicao",
        x: 0,
        y: 0,
        em: "c",
        espaco: 1,
        config: { condicao: "chance", chance },
      },
      { id: "a", tipo: "acao", x: 400, y: 40, config: anuncio(`passou ${id}`) },
    ],
    fios: [{ de: { no: "c", saida: "saida" }, para: { no: "a", entrada: "entrada" } }],
  });
  await ok(p, "fluxo.criar", { fluxo: caixaDeBotao("sim", 1) });
  await ok(p, "fluxo.criar", { fluxo: caixaDeBotao("nao", 0) });
  await ok(p, "botao.usar", { botaoId: "evento:sim" });
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "passou sim")).toBe(1);
  await ok(p, "botao.usar", { botaoId: "evento:nao" });
  await p.waitForTimeout(400);
  expect(vezesQueAnunciou(mestre.frames, "passou nao")).toBe(0);

  const caixaDeAcoes = (id: string, porta: "e" | "ou") => ({
    id,
    nome: id,
    cenas: null,
    ligado: true,
    caixas: true,
    nos: [
      { id: "g", tipo: "gatilho", x: 0, y: 40, config: { tipo: "botao", nome: id } },
      { id: "c", tipo: "caixa", x: 300, y: 40, config: { porta } },
      { id: "a1", tipo: "acao", x: 0, y: 0, em: "c", espaco: 0, config: anuncio(`${id} um`) },
      { id: "a2", tipo: "acao", x: 0, y: 0, em: "c", espaco: 1, config: anuncio(`${id} dois`) },
    ],
    fios: [{ de: { no: "g", saida: "saida" }, para: { no: "c", entrada: "entrada" } }],
  });
  await ok(p, "fluxo.criar", { fluxo: caixaDeAcoes("ambas", "e") });
  await ok(p, "botao.usar", { botaoId: "evento:ambas" });
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "ambas um")).toBe(1);
  await expect.poll(() => vezesQueAnunciou(mestre.frames, "ambas dois")).toBe(1);

  await ok(p, "fluxo.criar", { fluxo: caixaDeAcoes("sorteio", "ou") });
  for (let i = 1; i <= 14; i++) {
    await ok(p, "botao.usar", { botaoId: "evento:sorteio" });
    await expect
      .poll(
        () =>
          vezesQueAnunciou(mestre.frames, "sorteio um") +
          vezesQueAnunciou(mestre.frames, "sorteio dois"),
        { message: `disparo ${i}: uma só das duas ações` },
      )
      .toBe(i);
    // (o botão tem um intervalo mínimo entre cliques)
    await p.waitForTimeout(60);
  }
  expect(vezesQueAnunciou(mestre.frames, "sorteio um")).toBeGreaterThan(0);
  expect(vezesQueAnunciou(mestre.frames, "sorteio dois")).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------------------------------------------------
// O tour
// ---------------------------------------------------------------------------------------------------------------------

const CHAVE_NO_TESTE = "tabletop:pref:tourDasAutomacoesNoTeste";
const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const luzDe = async (p: Page, id: string) => (await luzes(p)).find((l) => l.id === id);

async function adiantar(request: APIRequestContext, ms: number) {
  const r = await request.post(`/teste/avancar-relogio?ms=${ms}`);
  expect(r.ok()).toBe(true);
}

/** Entra como mestre com o tour das automações ligado (no teste ele não abre sozinho a menos que a chave esteja ligada). */
async function entrarComOTour(mesa: Mesa) {
  const s = await mesa.abrir();
  await s.contexto.addInitScript((chave) => {
    try {
      localStorage.setItem(chave, "1");
    } catch {
      // sem armazenamento
    }
  }, CHAVE_NO_TESTE);
  await s.pagina.goto(CAMINHO_DA_MESA);
  await s.pagina.getByTestId("entrar-mestre").click();
  await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarMapa(s.pagina);
  return s;
}

const passoDoTour = (p: Page) => p.getByTestId("tour-auto");
async function avancarTour(p: Page, depoisDoPasso: string) {
  await p.getByTestId("tour-auto-proximo").click();
  await expect(passoDoTour(p)).toHaveAttribute("data-passo", depoisDoPasso);
}

test("o tour aparece na primeira vez que se abre o centro, não na segunda, e o 'Conhecer' o reabre", async ({
  mesa,
}) => {
  const mestre = await entrarComOTour(mesa);
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  // primeira vez: abre sozinho no passo do centro, com a lista iluminada
  await expect(passoDoTour(p)).toHaveAttribute("data-passo", "centro");
  await expect(p.getByTestId("tour-auto-titulo")).toContainText("O centro de automações");
  await expect(p.getByTestId("tour-auto-buraco")).toBeVisible();
  // pode ser pulado a qualquer passo
  await avancarTour(p, "mesa-de-eventos");
  await expect(p.getByTestId("tour-auto-texto")).toContainText("Liberar aos jogadores");
  await p.getByTestId("tour-auto-pular").click();
  await expect(passoDoTour(p)).toHaveCount(0);

  // segunda vez: não abre
  await p.getByTestId("automacoes-fechar").click();
  await expect(p.getByTestId("automacoes-janela")).toHaveCount(0);
  await abrirAutomacoes(p);
  await expect(p.getByTestId("auto-conhecer")).toBeVisible();
  await expect(passoDoTour(p)).toHaveCount(0);

  // o botão "Conhecer as automações" reabre
  await p.getByTestId("auto-conhecer").click();
  await expect(passoDoTour(p)).toHaveAttribute("data-passo", "centro");
  // Esc também pula
  await p.keyboard.press("Escape");
  await expect(passoDoTour(p)).toHaveCount(0);

  // no editor, o botão do editor abre o tour das peças, que explica cada grupo e ilumina a paleta
  const e = await abrirEditor(p, "auto-nova");
  await expect(passoDoTour(e)).toHaveCount(0);
  await e.getByTestId("ed-conhecer").click();
  await expect(passoDoTour(e)).toHaveAttribute("data-passo", "boas-vindas");
  for (const [passo, proximo, grupo] of [
    ["boas-vindas", "quando", null],
    ["quando", "fluxo", "ed-grupo-quando"],
    ["fluxo", "condicoes", "ed-grupo-fluxo"],
    ["condicoes", "caixas", "ed-grupo-condicao"],
    ["caixas", "acoes", "ed-grupo-logica"],
    ["acoes", "eventos", "ed-grupo-faca"],
  ] as const) {
    await expect(passoDoTour(e)).toHaveAttribute("data-passo", passo);
    if (grupo !== null) {
      // o buraco do tour acompanha o grupo de peças da paleta
      const g = await e.getByTestId(grupo).boundingBox();
      const b = await e.getByTestId("tour-auto-buraco").boundingBox();
      if (!g || !b) throw new Error(`sem caixa em ${passo}`);
      expect(Math.abs(b.x - g.x)).toBeLessThan(12);
      expect(Math.abs(b.y - g.y)).toBeLessThan(12);
    }
    await avancarTour(e, proximo);
  }
  await expect(e.getByTestId("tour-auto-texto")).toContainText("Liberar aos jogadores");
  await e.getByTestId("tour-auto-pular").click();
  await expect(passoDoTour(e)).toHaveCount(0);
  await e.close();
});

test("o tour monta 'as tochas têm 30% de chance de apagar a cada 3 minutos'; ligada e com o relógio adiantado, apaga tochas", async ({
  mesa,
  request,
}) => {
  const mestre = await entrarComOTour(mesa);
  const p = mestre.pagina;
  // duas tochas acesas, para ver o que a automação faz
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 2 });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-a" });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: "tocha-b" });
  await expect.poll(async () => (await luzDe(p, "tocha-a"))?.claraM).toBeGreaterThan(0);
  await expect.poll(async () => (await luzDe(p, "tocha-b"))?.claraM).toBeGreaterThan(0);

  await abrirAutomacoes(p);
  // o centro: três passos, e o último abre o editor já com o tour
  await expect(passoDoTour(p)).toHaveAttribute("data-passo", "centro");
  await avancarTour(p, "mesa-de-eventos");
  await avancarTour(p, "nova");
  await expect(p.getByTestId("tour-auto-proximo")).toContainText("Abrir o editor");
  const [e] = await Promise.all([
    p.waitForEvent("popup"),
    p.getByTestId("tour-auto-proximo").click(),
  ]);
  await expect(e.getByTestId("ed-raiz")).toBeVisible();
  await e.setViewportSize({ width: 1500, height: 860 });
  await expect(passoDoTour(e)).toHaveAttribute("data-passo", "boas-vindas");

  // as peças: seis explicações
  for (const proximo of [
    "quando",
    "fluxo",
    "condicoes",
    "caixas",
    "acoes",
    "eventos",
    "montar",
    "relogio",
  ]) {
    await avancarTour(e, proximo);
  }

  // 1. a cada 3 minutos: a pessoa escreve 180 no campo, o passo se completa e a frase acompanha
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "nao");
  await expect(e.getByTestId("tour-auto-proximo")).toBeDisabled();
  await e.getByTestId("ed-campo-cada").fill("180");
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "sim");
  await expect(e.getByTestId("ed-frase")).toContainText("A cada 3 min");
  await avancarTour(e, "para-cada");

  // 2. "Para cada": arrastado pela pessoa
  await soltarPeca(e, "paraCada", 700, 260); // n2
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "sim");
  await avancarTour(e, "ligar-relogio");

  // 3. ligar o relógio: com "Fazer este passo por mim"
  await expect(e.getByTestId("tour-auto-seta")).toBeVisible();
  await e.getByTestId("tour-auto-fazer").click();
  await expect(fio(e, "n1.saida", "n2.entrada")).toHaveCount(1);
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "sim");
  await avancarTour(e, "sortear");

  // 4 e 5. Sortear a 30%, arrastado e preenchido pela pessoa
  await soltarPeca(e, "sortear", 700, 420); // n3
  await avancarTour(e, "chance");
  await e.getByTestId("ed-campo-chance").fill("30");
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "sim");
  await avancarTour(e, "ligar-sorteio");

  // 6. "Cada um" do "Para cada" ligado ao sorteio, com o mouse
  await ligar(e, "n2", "corpo", "n3", "entrada");
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "sim");
  await avancarTour(e, "apagar");

  // 7. Apagar a tocha, pelo botão
  await e.getByTestId("tour-auto-fazer").click();
  await expect(e.locator('[data-testid^="ed-no-"][data-tipo="acao"]')).toHaveCount(1);
  await avancarTour(e, "ligar-apagar");

  // 8. o "sim" do sorteio ligado ao "Apagar a tocha"
  await ligar(e, "n3", "sim", "n4", "entrada");
  await expect(e.getByTestId("tour-auto-feito")).toHaveAttribute("data-feito", "sim");
  await avancarTour(e, "fim");

  // o fim: a automação está desligada, com a frase pronta; ligar agora a salva e liga
  await expect(e.getByTestId("ed-ligada")).toHaveAttribute("aria-checked", "false");
  await expect(e.getByTestId("ed-frase")).toContainText("A cada 3 min");
  await expect(e.getByTestId("ed-frase")).toContainText("com 30% de chance");
  await e.getByTestId("tour-auto-ligar-agora").click();
  await expect(passoDoTour(e)).toHaveCount(0);
  await expect(e.getByTestId("ed-ligada")).toHaveAttribute("aria-checked", "true");
  await expect(p.locator('[data-testid^="auto-item-"]')).toHaveCount(1);
  await expect(p.locator('[data-testid^="auto-item-"]')).toHaveAttribute("data-ligada", "true");

  // de verdade: com o relógio adiantado, a automação apaga tochas (30% por tocha a cada 3 minutos)
  for (let i = 0; i < 15; i++) {
    const a = (await luzDe(p, "tocha-a"))?.claraM ?? 0;
    const b = (await luzDe(p, "tocha-b"))?.claraM ?? 0;
    if (a === 0 || b === 0) break;
    await adiantar(request, 180_000);
    await p.waitForTimeout(150);
  }
  await expect
    .poll(async () => {
      const a = (await luzDe(p, "tocha-a"))?.claraM ?? 0;
      const b = (await luzDe(p, "tocha-b"))?.claraM ?? 0;
      return a === 0 || b === 0;
    })
    .toBe(true);
  await e.close();
});

test("o tour aparece de novo pelo botão do editor, e numa automação com trabalho não mexe nela", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await abrirAutomacoes(p);
  const e = await abrirEditor(p, "auto-nova");
  await e.getByTestId("ed-nome").fill("Já com trabalho");
  await e.getByTestId("ed-conhecer").click();
  for (const proximo of [
    "quando",
    "fluxo",
    "condicoes",
    "caixas",
    "acoes",
    "eventos",
    "sem-exemplo",
  ]) {
    await avancarTour(e, proximo);
  }
  await expect(e.getByTestId("tour-auto-texto")).toContainText("não mexo nela");
  await e.getByTestId("tour-auto-proximo").click();
  await expect(passoDoTour(e)).toHaveCount(0);
  // nada mudou na automação: o gatilho e o nome continuam
  await expect(e.getByTestId("ed-nome")).toHaveValue("Já com trabalho");
  await expect(e.locator('[data-testid^="ed-no-"]')).toHaveCount(1);
  await e.close();
});
