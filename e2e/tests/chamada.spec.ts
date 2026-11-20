import type { Page } from "@playwright/test";
import { argsDeMidiaFalsa } from "../midiaFalsa";
import {
  abrirPreferencia,
  CAMINHO_DA_MESA,
  expect,
  ID_DA_MESA,
  type Mesa,
  type Sessao,
  test,
} from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";

// CH1: a chamada da mesa. Três pessoas em contextos separados abrem a janela da chamada, entram, se veem e se ouvem (o
// vídeo recebido toca), e cada gesto (microfone, câmera, desfoque, sair) aparece nos outros. As câmeras e o microfone
// são os falsos do Chromium (só neste arquivo).

test.use({
  launchOptions: {
    args: argsDeMidiaFalsa(),
  },
});
test.describe.configure({ timeout: 180_000 });

type Diagnostico = {
  fase: string;
  fundo: string;
  fundoAtivo: boolean;
  enviaTrilhaDoCanvas: boolean;
  enviaCameraCrua: boolean;
  pares: string[];
  conexoes: Record<string, string>;
  bitrate: number | null;
};

const diagnostico = (p: Page) =>
  p.evaluate(() =>
    (
      window as unknown as { __tabletopChamada: { diagnostico: () => Diagnostico } }
    ).__tabletopChamada.diagnostico(),
  );

type Participante = { id: string; mesa: Sessao; janela: Page };

/** A pessoa entra na mesa, abre a janela da chamada pelo botão do topo e escolhe "Entrar na chamada". */
async function entrarNaChamada(
  mesa: Mesa,
  usuario: string,
  soOuvindo = false,
): Promise<Participante> {
  const s = await entrarNoMapa(mesa, usuario);
  const [janela] = await Promise.all([
    s.contexto.waitForEvent("page"),
    s.pagina.getByTestId("topo-chamada").click(),
  ]);
  janela.on("pageerror", (e) => console.log("[erro na janela da chamada]", e.message));
  await expect(janela.getByTestId("chamada-antes")).toBeVisible();
  await expect(janela).toHaveURL(new RegExp(`${CAMINHO_DA_MESA}/chamada$`));
  // a prévia mostra a própria câmera (o fluxo falso do navegador) antes de entrar
  if (!soOuvindo) {
    await expect
      .poll(() =>
        janela.evaluate(
          () =>
            document.querySelector<HTMLVideoElement>('[data-testid="chamada-previa-video"]')
              ?.videoWidth ?? 0,
        ),
      )
      .toBeGreaterThan(0);
  }
  await janela.getByTestId(soOuvindo ? "chamada-so-ouvindo" : "chamada-entrar").click();
  await expect(janela.getByTestId("chamada-janela")).toBeVisible();
  return { id: usuario, mesa: s, janela };
}

const quadro = (j: Page, id: string) => j.getByTestId(`chamada-quadro-${id}`);

/** O vídeo recebido de `id` toca nesta janela (largura do vídeo maior que zero). */
const videoTocando = (j: Page, id: string) =>
  j.evaluate(
    (alvo) =>
      document.querySelector<HTMLVideoElement>(`[data-testid="chamada-video-${alvo}"]`)
        ?.videoWidth ?? 0,
    id,
  );

async function tresNaChamada(mesa: Mesa) {
  const m = await entrarNaChamada(mesa, "mestre");
  const a = await entrarNaChamada(mesa, "jogador-1");
  const b = await entrarNaChamada(mesa, "jogador-2");
  for (const p of [m, a, b]) {
    for (const id of ["mestre", "jogador-1", "jogador-2"]) {
      await expect(quadro(p.janela, id)).toBeVisible();
    }
  }
  return { m, a, b };
}

test("três pessoas entram, cada uma vê os três quadros e o vídeo recebido toca; a mesa mostra a contagem e o ícone", async ({
  mesa,
}) => {
  const { m, a, b } = await tresNaChamada(mesa);
  for (const p of [m, a, b]) {
    for (const outro of [m, a, b].filter((x) => x !== p)) {
      await expect
        .poll(() => videoTocando(p.janela, outro.id), { timeout: 30_000 })
        .toBeGreaterThan(0);
    }
    await expect(p.janela.getByTestId("chamada-resumo")).toContainText("3 pessoas");
  }
  // a Trilha da mesa e a lista de pessoas estão lá
  await expect(m.janela.getByTestId("chamada-trilha")).toBeVisible();
  await expect(m.janela.getByTestId("chamada-lista")).toContainText("Na chamada — 3");
  // a mesa (janela principal) mostra quantos estão na chamada e o ícone na presença
  await expect(m.mesa.pagina.getByTestId("topo-chamada-contagem")).toHaveText("3");
  await expect(m.mesa.pagina.getByTestId("presenca-chamada-jogador-1")).toBeVisible();
  await expect(m.mesa.pagina.getByTestId("presenca-chamada-jogador-2")).toBeVisible();
  // quem fala aparece como o fluxo falso do microfone (um tom): o anel verde acende em alguém
  await expect
    .poll(() => m.janela.locator('[data-testid^="chamada-quadro-"][data-falando="sim"]').count(), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  // a conexão ponto a ponto está de pé
  await expect
    .poll(async () => Object.values((await diagnostico(m.janela)).conexoes))
    .toEqual(["connected", "connected"]);
});

test("microfone, câmera e desfoque aparecem nos outros; sair e fechar a janela tiram o quadro", async ({
  mesa,
}) => {
  const { m, a, b } = await tresNaChamada(mesa);
  await expect
    .poll(() => videoTocando(m.janela, "jogador-1"), { timeout: 30_000 })
    .toBeGreaterThan(0);

  // microfone desligado: o selo aparece nos outros e a mesa de quem desligou mostra o botão apertado
  await a.janela.getByTestId("chamada-microfone").click();
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-microfone", "desligado");
  await expect(quadro(b.janela, "jogador-1")).toHaveAttribute("data-microfone", "desligado");
  await expect(
    quadro(m.janela, "jogador-1").getByRole("img", { name: "Microfone desligado" }),
  ).toBeVisible();
  await a.janela.keyboard.press("m");
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-microfone", "ligado");

  // câmera desligada: vira a inicial na cor da pessoa; ligada de novo, o vídeo volta a tocar
  await a.janela.getByTestId("chamada-camera").click();
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-camera", "desligada");
  await expect(m.janela.getByTestId("chamada-inicial-jogador-1")).toBeVisible();
  await a.janela.getByTestId("chamada-camera").click();
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-camera", "ligada");
  await expect
    .poll(() => videoTocando(m.janela, "jogador-1"), { timeout: 30_000 })
    .toBeGreaterThan(0);

  // desfoque: a faixa enviada passa a ser a do canvas, o selo aparece nos outros e o vídeo segue tocando
  expect((await diagnostico(a.janela)).enviaCameraCrua).toBe(true);
  // CH3: o botão do fundo abre um menu com os três níveis (antes ligava e desligava direto)
  await a.janela.getByTestId("chamada-fundo").click();
  await a.janela.getByTestId("chamada-fundo-nivel-desfocar").click();
  await expect
    .poll(async () => (await diagnostico(a.janela)).enviaTrilhaDoCanvas, { timeout: 60_000 })
    .toBe(true);
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-fundo", "desfocar");
  await expect(m.janela.getByTestId("chamada-selo-fundo-jogador-1")).toBeVisible();
  await expect(a.janela.getByTestId("chamada-fundo")).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => videoTocando(m.janela, "jogador-1"), { timeout: 30_000 })
    .toBeGreaterThan(0);
  // CH3: o B passa ao próximo nível (Leve, Forte, Desligado); desligar volta à câmera crua
  await a.janela.keyboard.press("b");
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-fundo", "forte");
  await expect(a.janela.getByTestId("chamada-fundo-letra")).toHaveText("F");
  await a.janela.keyboard.press("b");
  await expect
    .poll(async () => (await diagnostico(a.janela)).enviaCameraCrua, { timeout: 15_000 })
    .toBe(true);
  await expect(quadro(m.janela, "jogador-1")).toHaveAttribute("data-fundo", "nenhum");

  // sair: o quadro some nos outros e a mesa de quem saiu volta a "antes de entrar"
  await a.janela.getByTestId("chamada-sair").click();
  await expect(a.janela.getByTestId("chamada-antes")).toBeVisible();
  await expect(quadro(m.janela, "jogador-1")).toHaveCount(0);
  await expect(quadro(b.janela, "jogador-1")).toHaveCount(0);
  await expect(m.mesa.pagina.getByTestId("topo-chamada-contagem")).toHaveText("2");
  await expect(m.mesa.pagina.getByTestId("presenca-chamada-jogador-1")).toHaveCount(0);

  // fechar a janela também é sair
  await b.janela.close();
  await expect(quadro(m.janela, "jogador-2")).toHaveCount(0);
  await expect(m.mesa.pagina.getByTestId("topo-chamada-contagem")).toHaveText("1");
});

test("a janela estreita vira linhas com miniatura; entrar de outra janela substitui a antiga", async ({
  mesa,
}) => {
  const { m, a } = await tresNaChamada(mesa);
  // a janela estreita entra sozinha abaixo de ~560 px
  await a.janela.setViewportSize({ width: 420, height: 640 });
  await expect(a.janela.getByTestId("chamada-janela")).toHaveAttribute("data-estreita", "true");
  await expect(a.janela.getByTestId("chamada-linhas")).toBeVisible();
  await expect(a.janela.getByTestId("chamada-abrir-grande")).toBeVisible();
  await a.janela.setViewportSize({ width: 1100, height: 720 });
  await expect(a.janela.getByTestId("chamada-janela")).toHaveAttribute("data-estreita", "false");

  // a janela da chamada segue o tema da mesa, ao vivo (sem seletor de tema dentro dela)
  await abrirPreferencia(m.mesa.pagina, "aparencia");
  await m.mesa.pagina.getByTestId("tema-claro").click();
  await expect(m.janela.locator("html")).toHaveAttribute("data-tema", "claro");
  await expect(m.janela.getByTestId("chamada-grade")).toHaveCount(0);
  await expect(m.janela.getByTestId("chamada-palco")).toHaveCount(0);

  // a mesma pessoa entra por outra janela (outro contexto com a mesma conta): a antiga sai e avisa
  const outra = await mesa.abrir();
  await outra.pagina.goto(`${CAMINHO_DA_MESA}/chamada`);
  await outra.pagina.getByTestId("entrar-jogador-1").click();
  await expect(outra.pagina.getByTestId("chamada-antes")).toBeVisible();
  await outra.pagina.getByTestId("chamada-entrar").click();
  await expect(a.janela.getByTestId("chamada-substituida")).toContainText("outra janela");
  await expect(m.janela.getByTestId("chamada-resumo")).toContainText("3 pessoas");
});

test("quem não é da mesa não recebe nada, e o aperto de mão só vai a quem está na chamada", async ({
  mesa,
}) => {
  const { m } = await tresNaChamada(mesa);
  // um membro que não entrou na chamada vê só a lista de quem está (nunca o aperto de mão)
  const fora = await entrarNoMapa(mesa, "jogador-3");
  await expect(fora.pagina.getByTestId("topo-chamada-contagem")).toHaveText("3");
  await expect(fora.pagina.getByTestId("presenca-chamada-mestre")).toBeVisible();
  expect(fora.frames.some((f) => f.includes('"tipo":"chamada.sinal"'))).toBe(false);
  expect(fora.frames.some((f) => f.includes('"tipo":"chamada.quem"'))).toBe(true);

  // quem manda sinal sem estar na chamada é barrado
  const cru = await fora.pagina.evaluate(
    ({ mesaId, alvo }) =>
      new Promise<string>((resolver) => {
        const ws = new WebSocket(`${location.origin.replace("http", "ws")}/api/m/${mesaId}/ws`);
        const tempo = setTimeout(() => resolver("sem resposta"), 4000);
        ws.addEventListener("open", () =>
          ws.send(
            JSON.stringify({
              v: 1,
              id: "x1",
              tipo: "chamada.sinal",
              dados: { para: alvo, descricao: { tipo: "offer", sdp: "v=0" } },
            }),
          ),
        );
        ws.addEventListener("message", (e) => {
          if (typeof e.data === "string" && e.data.includes('"tipo":"erro"')) {
            clearTimeout(tempo);
            resolver(e.data);
            ws.close();
          }
        });
      }),
    { mesaId: ID_DA_MESA, alvo: "mestre" },
  );
  expect(cru).toContain("fora_da_chamada");

  // sem sessão nenhuma (nem cookie), a sala nem abre o socket
  const anonimo = await mesa.abrir();
  await anonimo.pagina.goto(CAMINHO_DA_MESA);
  const abriu = await anonimo.pagina.evaluate(
    (mesaId) =>
      new Promise<string>((resolver) => {
        const ws = new WebSocket(`${location.origin.replace("http", "ws")}/api/m/${mesaId}/ws`);
        ws.addEventListener("open", () => resolver("abriu"));
        ws.addEventListener("error", () => resolver("recusou"));
        ws.addEventListener("close", () => resolver("recusou"));
      }),
    ID_DA_MESA,
  );
  expect(abriu).toBe("recusou");
  await expect(m.janela.getByTestId("chamada-resumo")).toContainText("3 pessoas");
});

// CH2: a grade da chamada sempre cabe (sem rolagem em nenhum tamanho), com no máximo 9 quadros por página.
type Medida = {
  rolagemArea: boolean;
  rolagemGrade: boolean;
  rolagemPagina: boolean;
  celulaFora: boolean;
  botaoCortado: boolean;
  quadros: number;
};
const medirGrade = (j: Page) =>
  j.evaluate((): Medida => {
    const grade = document.querySelector<HTMLElement>('[data-testid="chamada-quadros"]');
    const area = document.querySelector<HTMLElement>('[data-testid="chamada-area-da-grade"]');
    if (!grade || !area) throw new Error("sem grade");
    const caixa = area.getBoundingClientRect();
    const celulas = [...area.querySelectorAll<HTMLElement>(".chamada-celula")];
    const celulaFora = celulas.some((c) => {
      const r = c.getBoundingClientRect();
      return (
        r.left < caixa.left - 1 ||
        r.right > caixa.right + 1 ||
        r.top < caixa.top - 1 ||
        r.bottom > caixa.bottom + 1
      );
    });
    const trilha = area.querySelector<HTMLElement>('[data-testid="chamada-trilha"]');
    const botaoCortado = trilha
      ? [...trilha.querySelectorAll<HTMLElement>("button")].some((b) => {
          const t = trilha.getBoundingClientRect();
          const r = b.getBoundingClientRect();
          return r.bottom > t.bottom + 0.5 || r.right > t.right + 0.5 || r.top < t.top - 0.5;
        })
      : false;
    return {
      rolagemArea: area.scrollHeight > area.clientHeight || area.scrollWidth > area.clientWidth,
      rolagemGrade:
        grade.scrollHeight > grade.clientHeight || grade.scrollWidth > grade.clientWidth,
      rolagemPagina:
        document.documentElement.scrollHeight > window.innerHeight ||
        document.documentElement.scrollWidth > window.innerWidth,
      celulaFora,
      botaoCortado,
      quadros: celulas.length,
    };
  });

const fingir = (j: Page, falsas: number, quemFala: number | null = null) =>
  j.evaluate(
    ([n, q]) =>
      (
        window as unknown as { __tabletopChamadaFalsas: (n: number, q: number | null) => void }
      ).__tabletopChamadaFalsas(n as number, q as number | null),
    [falsas, quemFala],
  );

test("a grade da chamada cabe sem rolagem com 2, 5 e 9 pessoas e passa por páginas de até 9 quadros", async ({
  mesa,
}) => {
  const m = await entrarNaChamada(mesa, "mestre");
  const j = m.janela;
  await expect(j.getByTestId("chamada-trilha")).toBeVisible();
  for (const tela of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1000 },
  ]) {
    await j.setViewportSize(tela);
    // (pessoas, quadros na página: a trilha conta como um quadro e as páginas têm até 9)
    for (const [pessoas, quadros] of [
      [2, 3],
      [5, 6],
      [9, 9],
    ] as const) {
      await fingir(j, pessoas - 1);
      await expect(j.getByTestId("chamada-resumo")).toContainText(`${pessoas} pessoas`);
      await expect.poll(async () => (await medirGrade(j)).quadros).toBe(quadros);
      const med = await medirGrade(j);
      expect(med, `${pessoas} pessoas a ${tela.width}×${tela.height}`).toMatchObject({
        rolagemArea: false,
        rolagemGrade: false,
        rolagemPagina: false,
        celulaFora: false,
        botaoCortado: false,
      });
    }
  }

  // 11 pessoas + a trilha = 12 quadros: duas páginas (9 e 3); as setas e o teclado trocam
  await fingir(j, 10, 7);
  await expect(j.getByTestId("chamada-pagina-numero")).toHaveText("1/2");
  await expect.poll(async () => (await medirGrade(j)).quadros).toBe(9);
  expect(await medirGrade(j)).toMatchObject({ rolagemArea: false, celulaFora: false });
  // quem fala na página 1 não gera aviso; quem fala na página 2 acende o ponto na seta de avançar
  await expect(j.getByTestId("chamada-ponto-depois")).toHaveCount(0);
  await fingir(j, 10, 9);
  await expect(j.getByTestId("chamada-ponto-depois")).toBeVisible();
  await j.getByTestId("chamada-pagina-proxima").click();
  await expect(j.getByTestId("chamada-pagina-numero")).toHaveText("2/2");
  await expect.poll(async () => (await medirGrade(j)).quadros).toBe(3);
  await expect(j.getByTestId("chamada-trilha")).toBeVisible();
  expect(await medirGrade(j)).toMatchObject({ rolagemArea: false, celulaFora: false });
  await fingir(j, 10, 0);
  await expect(j.getByTestId("chamada-ponto-antes")).toBeVisible();
  await j.getByTestId("chamada-quadros").focus();
  await j.keyboard.press("ArrowLeft");
  await expect(j.getByTestId("chamada-pagina-numero")).toHaveText("1/2");
  await j.keyboard.press("ArrowRight");
  await expect(j.getByTestId("chamada-pagina-numero")).toHaveText("2/2");

  // fechar e abrir a lista lateral recalcula sem rolar
  await j.getByTestId("chamada-alternar-lista").click();
  expect(await medirGrade(j)).toMatchObject({ rolagemArea: false, celulaFora: false });
  await j.getByTestId("chamada-alternar-lista").click();
  expect(await medirGrade(j)).toMatchObject({ rolagemArea: false, celulaFora: false });
});
