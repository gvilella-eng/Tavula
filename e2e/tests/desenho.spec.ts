import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, esperarMapa, expect, intencaoCrua, test } from "./ajudas";
import {
  abrirPincel,
  camadaDeDesenho,
  centrar,
  comecarTraco,
  desenhoNaPagina,
  desenhoSelecionado,
  desenhosDe,
  escolherNoPincel,
  pixelNoMapa,
  rascunhosDe,
  tracar,
  zigueZague,
} from "./ajudasDesenho";
import { entrarNoMapa } from "./ajudasMapa";

// Lote 13: pincel e camada de desenho. A semente tem a Cena inicial (cena-1, 60 × 45 m, luz ambiente 0,1,
// grupo dela) e o Covil. Os jogadores 1 a 3 têm um token cada. A vista fica em zoom 1 e centrada em (12, 10):
// o que se desenha entre x 4 e 18 e y 4 e 14 está à vista e fora dos painéis.

const quantos = async (p: Page) => (await desenhosDe(p)).length;
const rascunhos = async (p: Page) => (await rascunhosDe(p)).length;

/** Intenção crua pelo WebSocket da própria página (o que um cliente adulterado mandaria). */
const cru = (p: Page, tipo: string, dados: object) => enviarCru(p, intencaoCrua(tipo, dados));

async function mesaComDois(mesa: Parameters<typeof entrarNoMapa>[0]) {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await centrar(mestre.pagina, 12, 10);
  await centrar(j1.pagina, 12, 10);
  return { mestre, j1 };
}

test("o jogador desenha um traço livre: o mestre vê o rascunho ao vivo e depois o desenho gravado; recarregar mantém", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  await abrirPincel(j1.pagina);
  await escolherNoPincel(j1.pagina, "livre");

  const soltar = await comecarTraco(j1.pagina, zigueZague({ x: 5, y: 6 }, { x: 15, y: 12 }));
  // enquanto o traço está em andamento: o mestre o vê ao vivo, e ainda não há nada gravado
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(1);
  const [vivo] = await rascunhosDe(mestre.pagina);
  expect(vivo?.autorId).toBe("jogador-1");
  expect(vivo?.forma).toBe("livre");
  expect(await quantos(mestre.pagina)).toBe(0);
  // quem desenha não recebe o próprio rascunho
  expect(await rascunhos(j1.pagina)).toBe(0);

  await soltar();
  await expect.poll(() => quantos(mestre.pagina)).toBe(1);
  await expect.poll(() => quantos(j1.pagina)).toBe(1);
  const [gravado] = await desenhosDe(mestre.pagina);
  expect(gravado).toMatchObject({ forma: "livre", autorId: "jogador-1", cor: "#e6194b" });
  expect(gravado?.pontos).toBeGreaterThanOrEqual(2);
  // o rascunho some quando o desenho chega, e o id é o mesmo do rascunho
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(0);
  expect(gravado?.id).toBe(vivo?.id);
  expect(j1.enviados.filter((f) => f.includes('"tipo":"desenho.criar"'))).toHaveLength(1);
  expect(
    mestre.frames.filter((f) => f.includes('"tipo":"desenho.rascunhando"')).length,
  ).toBeGreaterThan(0);

  // gravado na sala: recarregar mantém (jogador e mestre)
  for (const s of [j1, mestre]) {
    await s.pagina.reload();
    await esperarMapa(s.pagina);
    await expect.poll(() => quantos(s.pagina)).toBe(1);
  }
});

test("linha, retângulo preenchido e círculo; a borracha apaga um desenho inteiro; voltar apaga só o meu mais recente", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);

  // o mestre desenha com a camada de trabalho em "Mestre": desenhar não a troca
  await mestre.pagina.getByTestId("menu-camadas").click();
  await mestre.pagina.getByTestId("camada-mestre").click();
  await abrirPincel(mestre.pagina);
  await escolherNoPincel(mestre.pagina, "linha");
  await tracar(mestre.pagina, [
    { x: 4, y: 13 },
    { x: 16, y: 13 },
  ]);
  await expect.poll(() => quantos(j1.pagina)).toBe(1);
  await mestre.pagina.getByTestId("pincel-fechar").click();
  await mestre.pagina.getByTestId("menu-camadas").click();
  await expect(mestre.pagina.getByTestId("camada-mestre")).toHaveAttribute("aria-pressed", "true");
  await mestre.pagina.getByTestId("camada-mestre").click();

  const p = j1.pagina;
  await abrirPincel(p);
  await escolherNoPincel(p, "linha");
  await p.getByTestId("pincel-cor-f58231").click();
  await tracar(p, [
    { x: 4, y: 5 },
    { x: 10, y: 5 },
  ]);
  await escolherNoPincel(p, "retangulo");
  await p.getByTestId("pincel-preenchido").click();
  await p.getByTestId("pincel-cor-4363d8").click();
  await tracar(p, [
    { x: 4, y: 7 },
    { x: 9, y: 10 },
  ]);
  await escolherNoPincel(p, "circulo");
  await p.getByTestId("pincel-cor-3cb44b").click();
  await p.getByTestId("pincel-preenchido").click(); // desliga: círculo vazado
  await tracar(p, [
    { x: 14, y: 8 },
    { x: 16.5, y: 8 },
  ]);

  for (const s of [mestre, j1]) await expect.poll(() => quantos(s.pagina)).toBe(4);
  const vistos = (await desenhosDe(mestre.pagina)).filter((d) => d.autorId === "jogador-1");
  expect(vistos.map((d) => [d.forma, d.cor, d.preenchido])).toEqual([
    ["linha", "#f58231", false],
    ["retangulo", "#4363d8", true],
    ["circulo", "#3cb44b", false],
  ]);

  // borracha: atravessar a linha laranja apaga a linha inteira, e só ela
  await escolherNoPincel(p, "borracha");
  await tracar(p, [
    { x: 7, y: 4.4 },
    { x: 7, y: 5.6 },
  ]);
  for (const s of [mestre, j1]) await expect.poll(() => quantos(s.pagina)).toBe(3);
  expect((await desenhosDe(p)).map((d) => d.forma)).toEqual(["linha", "retangulo", "circulo"]);
  expect((await desenhosDe(p)).find((d) => d.forma === "linha")?.autorId).toBe("mestre");
  // a borracha não apaga o do mestre (a sala também recusaria)
  await tracar(p, [
    { x: 10, y: 12.4 },
    { x: 10, y: 13.6 },
  ]);
  await p.waitForTimeout(400);
  expect(await quantos(p)).toBe(3);

  // voltar: apaga o meu desenho mais recente (o círculo), depois o retângulo; nunca o do mestre
  await p.getByTestId("pincel-desfazer").click();
  for (const s of [mestre, j1]) await expect.poll(() => quantos(s.pagina)).toBe(2);
  expect((await desenhosDe(mestre.pagina)).map((d) => d.forma)).toEqual(["linha", "retangulo"]);
  await p.getByTestId("pincel-desfazer").click();
  for (const s of [mestre, j1]) await expect.poll(() => quantos(s.pagina)).toBe(1);
  await p.getByTestId("pincel-desfazer").click();
  await p.waitForTimeout(400);
  expect(await quantos(mestre.pagina)).toBe(1);
  expect((await desenhosDe(mestre.pagina))[0]?.autorId).toBe("mestre");
});

test("o jogador não mexe no desenho do mestre (a interface não deixa e a sala recusa); o mestre mexe em todos", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  await abrirPincel(mestre.pagina);
  await escolherNoPincel(mestre.pagina, "linha");
  await tracar(mestre.pagina, [
    { x: 4, y: 5 },
    { x: 10, y: 5 },
  ]);
  await expect.poll(() => quantos(j1.pagina)).toBe(1);
  const [doMestre] = await desenhosDe(j1.pagina);
  if (!doMestre) throw new Error("sem desenho do mestre");

  const p = j1.pagina;
  await abrirPincel(p);
  await escolherNoPincel(p, "linha");
  await tracar(p, [
    { x: 4, y: 9 },
    { x: 10, y: 9 },
  ]);
  await expect.poll(() => quantos(mestre.pagina)).toBe(2);
  // a confirmação da sala pode chegar ao autor um pouco depois de chegar ao mestre
  await expect
    .poll(async () => (await desenhosDe(p)).some((d) => d.autorId === "jogador-1"))
    .toBe(true);
  const meu = (await desenhosDe(p)).find((d) => d.autorId === "jogador-1");
  if (!meu) throw new Error("sem desenho do jogador");

  // selecionar: o jogador clica no desenho do mestre e nada é selecionado; arrastar não o move
  await escolherNoPincel(p, "selecionar");
  const alvo = await desenhoNaPagina(p, doMestre.id);
  if (!alvo) throw new Error("sem ponto");
  await p.mouse.click(alvo.x, alvo.y);
  expect(await desenhoSelecionado(p)).toBeNull();
  await p.mouse.move(alvo.x, alvo.y);
  await p.mouse.down();
  await p.mouse.move(alvo.x, alvo.y + 80, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  expect((await desenhosDe(p)).find((d) => d.id === doMestre.id)?.ponto0).toEqual({ x: 4, y: 5 });
  expect(j1.enviados.filter((f) => f.includes('"tipo":"desenho.mover"'))).toHaveLength(0);

  // a sala recusa o que um cliente adulterado mandar
  const mover = await cru(p, "desenho.mover", { id: doMestre.id, dx: 1, dy: 1 });
  expect(mover?.dados.codigo).toBe("sem_permissao");
  const apagar = await cru(p, "desenho.apagar", { ids: [doMestre.id] });
  expect(apagar?.dados.codigo).toBe("sem_permissao");
  expect(await quantos(mestre.pagina)).toBe(2);

  // o jogador seleciona e move o próprio: o destaque aparece e a sala confirma a posição nova
  const meuAlvo = await desenhoNaPagina(p, meu.id);
  if (!meuAlvo) throw new Error("sem ponto");
  await p.mouse.click(meuAlvo.x, meuAlvo.y);
  expect(await desenhoSelecionado(p)).toBe(meu.id);
  await p.mouse.move(meuAlvo.x, meuAlvo.y);
  await p.mouse.down();
  await p.mouse.move(meuAlvo.x, meuAlvo.y + 80, { steps: 8 }); // 2 m para baixo
  await p.mouse.up();
  await expect
    .poll(async () => (await desenhosDe(mestre.pagina)).find((d) => d.id === meu.id)?.ponto0)
    .toEqual({ x: 4, y: 11 });

  // o mestre seleciona o do jogador, move e apaga com Delete (todos veem)
  const m = mestre.pagina;
  await escolherNoPincel(m, "selecionar");
  const alvoDoJogador = await desenhoNaPagina(m, meu.id);
  if (!alvoDoJogador) throw new Error("sem ponto");
  await m.mouse.click(alvoDoJogador.x, alvoDoJogador.y);
  expect(await desenhoSelecionado(m)).toBe(meu.id);
  await m.mouse.move(alvoDoJogador.x, alvoDoJogador.y);
  await m.mouse.down();
  await m.mouse.move(alvoDoJogador.x + 40, alvoDoJogador.y, { steps: 6 }); // 1 m para a direita
  await m.mouse.up();
  await expect
    .poll(async () => (await desenhosDe(p)).find((d) => d.id === meu.id)?.ponto0)
    .toEqual({ x: 5, y: 11 });
  await m.keyboard.press("Delete");
  for (const s of [mestre, j1]) await expect.poll(() => quantos(s.pagina)).toBe(1);
  expect((await desenhosDe(p))[0]?.id).toBe(doMestre.id);

  // o jogador seleciona o próprio e apaga com Delete
  await escolherNoPincel(p, "linha");
  await tracar(p, [
    { x: 4, y: 12 },
    { x: 9, y: 12 },
  ]);
  await expect.poll(() => quantos(p)).toBe(2);
  await escolherNoPincel(p, "selecionar");
  const novo = (await desenhosDe(p)).find((d) => d.autorId === "jogador-1");
  const ponto = novo ? await desenhoNaPagina(p, novo.id) : null;
  if (!novo || !ponto) throw new Error("sem desenho novo");
  await p.mouse.click(ponto.x, ponto.y);
  await p.keyboard.press("Delete");
  for (const s of [mestre, j1]) await expect.poll(() => quantos(s.pagina)).toBe(1);
});

test("Esc cancela o traço em andamento: nada é gravado e o rascunho some para os outros", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  await abrirPincel(j1.pagina);
  await escolherNoPincel(j1.pagina, "retangulo");
  const soltar = await comecarTraco(j1.pagina, [
    { x: 5, y: 6 },
    { x: 12, y: 11 },
  ]);
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(1);
  await j1.pagina.keyboard.press("Escape");
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(0);
  await soltar();
  await j1.pagina.waitForTimeout(400);
  expect(await quantos(mestre.pagina)).toBe(0);
  expect(await quantos(j1.pagina)).toBe(0);
  expect(
    j1.enviados.some(
      (f) => f.includes('"tipo":"desenho.rascunho"') && f.includes('"desenho":null'),
    ),
  ).toBe(true);
  expect(j1.enviados.filter((f) => f.includes('"tipo":"desenho.criar"'))).toHaveLength(0);

  // um clique sem arrastar não faz retângulo
  await tracar(j1.pagina, [{ x: 8, y: 8 }]);
  await j1.pagina.waitForTimeout(400);
  expect(await quantos(mestre.pagina)).toBe(0);
  // mas faz um pingo no traço livre
  await escolherNoPincel(j1.pagina, "livre");
  await tracar(j1.pagina, [{ x: 8, y: 8 }]);
  await expect.poll(() => quantos(mestre.pagina)).toBe(1);
});

test("quem sai no meio de um traço: o rascunho dele some para os outros", async ({ mesa }) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  await abrirPincel(j1.pagina);
  await escolherNoPincel(j1.pagina, "livre");
  await comecarTraco(j1.pagina, zigueZague({ x: 5, y: 6 }, { x: 15, y: 12 }));
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(1);
  await j1.contexto.close();
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(0);
  expect(await quantos(mestre.pagina)).toBe(0);
});

test("o desenho aparece no escuro: acima do véu, fora do alcance da visão", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await cru(mestre.pagina, "cena.configurarIluminacao", { luzAmbiente: 0 });
  await centrar(mestre.pagina, 12, 10);
  await centrar(j2.pagina, 12, 10);
  // Brisa (jogador-2) não tem visão no escuro e está longe das luzes: ali é escuridão total
  await expect
    .poll(() =>
      j2.pagina.evaluate(() =>
        (
          window as unknown as {
            __tabletop: { visaoNoPonto(x: number, y: number): string };
          }
        ).__tabletop.visaoNoPonto(7, 6),
      ),
    )
    .toBe("nenhuma");
  expect((await camadaDeDesenho(j2.pagina)).acimaDoVeu).toBe(true);

  await abrirPincel(j2.pagina);
  await escolherNoPincel(j2.pagina, "linha");
  await j2.pagina.getByTestId("pincel-espessura-14").click();
  await tracar(j2.pagina, [
    { x: 4, y: 6 },
    { x: 10, y: 6 },
  ]);
  for (const s of [mestre, j2]) await expect.poll(() => quantos(s.pagina)).toBe(1);

  // o pixel no meio do traço é a cor do desenho (#e6194b), não o preto da escuridão; ao lado, é escuro
  const claro = await pixelNoMapa(j2.pagina, 7, 6);
  const escuro = await pixelNoMapa(j2.pagina, 7, 3);
  expect(claro[0]).toBeGreaterThan(170);
  expect(claro[1]).toBeLessThan(90);
  expect(escuro[0]).toBeLessThan(60);
  expect(escuro[2]).toBeLessThan(70);
});

test("o mestre desliga desenho.criar e o jogador perde o pincel na hora (a sala também recusa)", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  const p = j1.pagina;
  await abrirPincel(p);
  // R2: a barra fica à vista e a sub-barra abre ao lado dela; o botão do pincel fica apertado
  await expect(p.getByTestId("ferramenta-pincel")).toHaveAttribute("aria-pressed", "true");
  await abrirAba(mestre.pagina, "mestre");
  const caixa = mestre.pagina.getByTestId("perm-padrao-desenho.criar");
  await expect(caixa).toBeChecked();
  await caixa.click();

  // a sub-barra fecha sozinha e o botão do pincel fica apagado, com a explicação ao clicar
  await expect(p.getByTestId("sub-barra-pincel")).toHaveCount(0);
  await expect(p.getByTestId("ferramenta-pincel")).toHaveAttribute("aria-disabled", "true");
  await p.getByTestId("ferramenta-pincel").click({ force: true });
  await expect(p.getByTestId("sub-barra-pincel")).toHaveCount(0);
  await expect(p.getByTestId("pincel-sem-permissao")).toContainText("mestre");
  const recusa = await cru(p, "desenho.criar", {
    desenho: {
      id: "x1",
      forma: "livre",
      pontos: [{ x: 5, y: 5 }],
      cor: "#ffffff",
      espessura: 4,
    },
  });
  expect(recusa?.dados.codigo).toBe("sem_permissao");
  expect(await quantos(mestre.pagina)).toBe(0);

  // religar devolve o pincel
  await caixa.click();
  await expect(p.getByTestId("ferramenta-pincel")).not.toHaveAttribute("aria-disabled", "true");
  await abrirPincel(p);
});

test("Limpar desenhos: o mestre confirma e a cena fica sem desenhos para todos; recarregar mantém", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await centrar(j2.pagina, 12, 10);
  await abrirPincel(j1.pagina);
  await escolherNoPincel(j1.pagina, "livre");
  await tracar(j1.pagina, zigueZague({ x: 5, y: 6 }, { x: 12, y: 6 }));
  await abrirPincel(mestre.pagina);
  await escolherNoPincel(mestre.pagina, "circulo");
  await tracar(mestre.pagina, [
    { x: 13, y: 9 },
    { x: 15, y: 9 },
  ]);
  for (const s of [mestre, j1, j2]) await expect.poll(() => quantos(s.pagina)).toBe(2);
  // um desenho de outra cena (só o mestre o recebe)
  const outra = await cru(mestre.pagina, "desenho.criar", {
    desenho: {
      id: "no-covil",
      cenaId: "cena-covil",
      forma: "linha",
      pontos: [
        { x: 2, y: 2 },
        { x: 8, y: 8 },
      ],
      cor: "#ffffff",
      espessura: 4,
    },
  });
  expect(outra?.tipo).toBe("evento");
  await mestre.pagina.waitForTimeout(300);
  expect(j1.frames.some((f) => f.includes("no-covil"))).toBe(false);
  expect(mestre.frames.some((f) => f.includes("no-covil"))).toBe(true); // o mestre recebe todos

  // o jogador não tem o botão; a sala também recusa
  const recusa = await cru(j1.pagina, "desenho.limpar", {});
  expect(recusa?.dados.codigo).toBe("sem_permissao");

  const m = mestre.pagina;
  await m.getByTestId("pincel-fechar").click();
  await m.getByTestId("menu-camadas").click();
  await m.getByTestId("limpar-desenhos").click();
  await expect(m.getByTestId("limpar-desenhos-confirmacao")).toContainText("2 desenhos");
  await m.getByTestId("limpar-desenhos-cancelar").click();
  await expect(m.getByTestId("limpar-desenhos-confirmacao")).toHaveCount(0);
  expect(await quantos(m)).toBe(2);
  await m.getByTestId("limpar-desenhos").click();
  await m.getByTestId("limpar-desenhos-confirmar").click();
  for (const s of [mestre, j1, j2]) await expect.poll(() => quantos(s.pagina)).toBe(0);
  await m.getByTestId("menu-camadas").click();
  await expect(m.getByTestId("limpar-desenhos")).toBeDisabled();
  await m.keyboard.press("Escape");

  // o do Covil continua (outra cena) e o estado limpo foi gravado
  await j1.pagina.reload();
  await esperarMapa(j1.pagina);
  expect(await quantos(j1.pagina)).toBe(0);
});

test("o rascunho respeita o limite de frequência da sala e só vai a quem recebe a cena", async ({
  mesa,
}) => {
  const { mestre, j1 } = await mesaComDois(mesa);
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  // 60 rascunhos de uma vez: a sala descarta os que chegam rápido demais
  await j1.pagina.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/ws`);
        ws.onopen = () => {
          for (let i = 0; i < 60; i++) {
            ws.send(
              JSON.stringify({
                v: 1,
                id: `flood-${i}`,
                tipo: "desenho.rascunho",
                dados: {
                  id: "flood",
                  desenho: {
                    forma: "livre",
                    pontos: [
                      { x: 5, y: 5 },
                      { x: 5 + i * 0.1, y: 6 },
                    ],
                    cor: "#ffffff",
                    espessura: 4,
                  },
                },
              }),
            );
          }
          setTimeout(() => {
            ws.close();
            resolve();
          }, 600);
        };
      }),
  );
  // quem fechou o socket no meio do rascunho: o fim chega aos outros (a sala trata o fechamento sem
  // pressa; com a máquina carregada, o aviso pode chegar depois do resolve acima)
  await expect
    .poll(() => mestre.frames.some((f) => f.includes('"tipo":"desenho.rascunhoFim"')))
    .toBe(true);
  await expect.poll(() => rascunhos(mestre.pagina)).toBe(0);
  const recebidos = mestre.frames.filter((f) => f.includes('"tipo":"desenho.rascunhando"'));
  expect(recebidos.length).toBeGreaterThanOrEqual(1);
  expect(recebidos.length).toBeLessThan(20);

  // rascunho de outra cena: só o mestre (que a vê) poderia receber; o jogador não
  await cru(mestre.pagina, "desenho.rascunho", {
    id: "outro",
    desenho: {
      cenaId: "cena-covil",
      forma: "linha",
      pontos: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      cor: "#ffffff",
      espessura: 4,
    },
  });
  await j2.pagina.waitForTimeout(300);
  expect(j2.frames.some((f) => f.includes('"id":"outro"'))).toBe(false);
  expect(j1.frames.some((f) => f.includes('"id":"outro"'))).toBe(false);
});
