import type { Page } from "@playwright/test";
import { abrirFaixa, enviarCru, expect, intencaoCrua, type Sessao, test } from "./ajudas";
import { assets, pngDeRuido } from "./ajudasAssets";
import { gerarToken } from "./ajudasClaude";
import { enviarPor, linkDoTexto } from "./ajudasEnvio";
import { entrarNoMapa, esperarPosicao, type GanchoDoMapa } from "./ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "./ajudasMcp";

// Q3: importar mapas do Dungeondraft (Universal VTT). O .dd2vtt é GERADO aqui (um PNG de 700 x 700 px com a grade de 70 px, uma
// sala de 6 x 6 quadrados com uma porta no lado sul, uma luz e uma parede de objeto); nada é baixado.

test.describe.configure({ timeout: 180_000 });

/** A sala fica dos quadrados 2 a 8 (3 a 12 m); a porta fechada fica no lado sul, de 4 a 5 (6 a 7,5 m, y = 12 m). */
function dd2vtt(extra: Record<string, unknown> = {}): Buffer {
  const png = pngDeRuido(700, 700, 3, 35);
  return Buffer.from(
    JSON.stringify({
      format: 0.3,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 10, y: 10 },
        pixels_per_grid: 70,
      },
      line_of_sight: [
        [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 5, y: 8 },
        ],
        [
          { x: 4, y: 8 },
          { x: 2, y: 8 },
          { x: 2, y: 2 },
        ],
      ],
      objects_line_of_sight: [],
      portals: [
        {
          position: { x: 4.5, y: 8 },
          bounds: [
            { x: 4, y: 8 },
            { x: 5, y: 8 },
          ],
          rotation: 0,
          closed: true,
          freestanding: false,
        },
      ],
      environment: { baked_lighting: true, ambient_light: "ffffffff" },
      lights: [
        { position: { x: 5, y: 5 }, range: 4, intensity: 1, color: "ffeccd8b", shadows: true },
      ],
      image: `data:image/png;base64,${png.toString("base64")}`,
      ...extra,
    }),
    "utf8",
  );
}

const RESUMO = "Cena criada: 1 mapa, 5 paredes, 1 porta, 1 luz.";
/** As paredes e as portas de uma cena importada (os ids começam pelo id da cena). */
const paredesDe = (p: Page, cenaId: string) =>
  p
    .evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes())
    .then((l) => l.filter((w) => w.id.startsWith(`${cenaId}-`)));
const portasDe = (p: Page, cenaId: string) =>
  p
    .evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.portas())
    .then((l) => l.filter((w) => w.id.startsWith(`${cenaId}-`)));

const ve = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.veNoPonto(
        px as number,
        py as number,
      ),
    [x, y],
  );

async function importarPelaTela(s: Sessao, arquivo: Buffer, nome = "sala-teste.dd2vtt") {
  await abrirFaixa(s.pagina);
  await expect(s.pagina.getByTestId("cena-importar-uvtt")).toBeVisible();
  await s.pagina
    .getByTestId("cena-importar-uvtt-arquivo")
    .setInputFiles({ name: nome, mimeType: "application/octet-stream", buffer: arquivo });
}

async function idDaCenaPeloNome(p: Page, nome: string): Promise<string> {
  await abrirFaixa(p);
  const card = p.locator('[data-testid="cena-card"]').filter({ hasText: nome });
  await expect(card).toHaveCount(1);
  return (await card.getAttribute("data-cena-id")) ?? "";
}

test("importar pela tela cria a cena com o mapa no tamanho certo, as paredes, a porta e a luz, e mostra o resumo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  // A "pasta" do teste vale como a pasta local com escrita: a cópia da imagem vai para `mapas/`.
  await assets(mestre.pagina, "usarMemoriaComoPasta", true);
  await importarPelaTela(mestre, dd2vtt());

  const aviso = mestre.pagina.getByTestId("aviso-importacao");
  await expect(aviso).toHaveAttribute("data-estado", "pronto");
  await expect(mestre.pagina.getByTestId("aviso-importacao-texto")).toHaveText(RESUMO);

  const id = await idDaCenaPeloNome(mestre.pagina, "sala-teste");
  // 700 px / 70 px por quadrado = 10 quadrados de 1,5 m = 15 m; o grupo continua na cena de antes.
  const criada = mestre.frames.find(
    (f) => f.includes('"cena.criada"') && f.includes('"nome":"sala-teste"'),
  );
  expect(criada).toBeTruthy();
  expect(criada).toContain('"larguraM":15');
  expect(criada).toContain('"alturaM":15');
  expect(criada).toContain('"pxPorQuadrado":70');
  await expect(
    mestre.pagina.locator('[data-testid="cena-card"][data-cena-id="cena-1"]'),
  ).toHaveAttribute("data-do-grupo", "true");
  // O mapa entrou pelo caminho do botão de subir (tiles) e a cópia foi para `mapas/`.
  const metas = await assets(mestre.pagina, "metas");
  expect(metas.some((m) => m.tipo === "mapa" && m.nomeOriginal === "sala-teste.png")).toBe(true);
  await expect
    .poll(async () => (await assets(mestre.pagina, "gravados")).map((g) => g.caminho))
    .toContain("mapas/sala-teste.png");

  // O mestre abre a cena: as paredes e a porta (fechada) estão lá.
  await mestre.pagina.locator(`[data-testid="cena-card"][data-cena-id="${id}"]`).click();
  await expect.poll(() => paredesDe(mestre.pagina, id).then((l) => l.length)).toBe(6);
  const portas = await portasDe(mestre.pagina, id);
  expect(portas).toHaveLength(1);
  expect(portas[0]?.estado).toBe("fechada");
  // Fechar o aviso.
  await mestre.pagina.getByTestId("aviso-importacao-fechar").click();
  await expect(aviso).toHaveCount(0);
});

test("a porta importada abre e fecha, e a parede importada bloqueia a visão do jogador", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const jogador = await entrarNoMapa(mesa, "jogador-1");
  await importarPelaTela(mestre, dd2vtt());
  await expect(mestre.pagina.getByTestId("aviso-importacao")).toHaveAttribute(
    "data-estado",
    "pronto",
  );
  const id = await idDaCenaPeloNome(mestre.pagina, "sala-teste");

  // Enquanto o grupo não está lá, o jogador não recebe nada da cena importada (nem a cena, nem as paredes, nem a luz).
  await expect.poll(() => mestre.frames.some((f) => f.includes(id))).toBe(true);
  expect(jogador.frames.some((f) => f.includes(id))).toBe(false);

  // Leva o grupo para a cena importada e põe o jogador dentro da sala (7,5 m, 7,5 m).
  await enviarCru(mestre.pagina, intencaoCrua("grupo.moverPara", { cenaId: id }));
  await expect.poll(() => paredesDe(jogador.pagina, id).then((l) => l.length)).toBe(6);
  await enviarCru(
    mestre.pagina,
    intencaoCrua("token.soltar", { id: "tok-jogador-1", x: 7.5, y: 7.5 }),
  );
  await esperarPosicao(jogador.pagina, "tok-jogador-1", 7.5, 7.5);

  // Dentro da sala ele vê; atrás da parede leste (x = 12 m) e atrás da porta fechada (y = 12 m), não.
  await expect.poll(() => ve(jogador.pagina, 9, 9)).toBe(true);
  await expect.poll(() => ve(jogador.pagina, 13.7, 7.5)).toBe(false);
  await expect.poll(() => ve(jogador.pagina, 6.75, 13.7)).toBe(false);

  // A porta abre (o que está atrás dela aparece) e fecha de novo.
  const porta = (await portasDe(jogador.pagina, id))[0];
  expect(porta?.estado).toBe("fechada");
  const idDaPorta = porta?.id ?? "";
  await enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: idDaPorta }));
  await expect.poll(async () => (await portasDe(jogador.pagina, id))[0]?.estado).toBe("aberta");
  await expect.poll(() => ve(jogador.pagina, 6.75, 13.7)).toBe(true);
  // A parede continua bloqueando.
  expect(await ve(jogador.pagina, 13.7, 7.5)).toBe(false);
  await enviarCru(mestre.pagina, intencaoCrua("porta.alternar", { id: idDaPorta }));
  await expect.poll(async () => (await portasDe(jogador.pagina, id))[0]?.estado).toBe("fechada");
  await expect.poll(() => ve(jogador.pagina, 6.75, 13.7)).toBe(false);
});

test("arrastar o arquivo para a mesa também importa; arquivo ruim mostra o motivo", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const soltar = (nome: string, conteudo: Buffer) =>
    mestre.pagina.evaluate(
      ([n, b64]) => {
        const bytes = Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0));
        const dados = new DataTransfer();
        dados.items.add(new File([bytes], n as string));
        const sobre = new DragEvent("dragover", {
          dataTransfer: dados,
          cancelable: true,
          bubbles: true,
        });
        window.dispatchEvent(sobre);
        window.dispatchEvent(
          new DragEvent("drop", { dataTransfer: dados, cancelable: true, bubbles: true }),
        );
      },
      [nome, conteudo.toString("base64")],
    );

  await abrirFaixa(mestre.pagina);
  await soltar("torre.uvtt", dd2vtt());
  await expect(mestre.pagina.getByTestId("aviso-importacao-texto")).toHaveText(RESUMO);
  await idDaCenaPeloNome(mestre.pagina, "torre");

  // Um .dd2vtt sem imagem não vira cena: o aviso diz por quê.
  await mestre.pagina.getByTestId("aviso-importacao-fechar").click();
  await soltar(
    "vazio.dd2vtt",
    Buffer.from(JSON.stringify({ resolution: { pixels_per_grid: 70 } })),
  );
  await expect(mestre.pagina.getByTestId("aviso-importacao")).toHaveAttribute(
    "data-estado",
    "erro",
  );
  await expect(mestre.pagina.getByTestId("aviso-importacao-texto")).toContainText(
    "não traz a imagem do mapa",
  );
  await expect(
    mestre.pagina.locator('[data-testid="cena-card"]').filter({ hasText: "vazio" }),
  ).toHaveCount(0);
});

test("o jogador não vê a opção e a sala recusa se ele tentar", async ({ mesa }) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const jogador = await entrarNoMapa(mesa, "jogador-1");
  await abrirFaixa(mestre.pagina);
  await expect(mestre.pagina.getByTestId("cena-importar-uvtt")).toBeVisible();
  const cenasAntes = await mestre.pagina.locator('[data-testid="cena-card"]').count();
  await expect(jogador.pagina.getByTestId("cena-importar-uvtt")).toHaveCount(0);
  await expect(jogador.pagina.getByTestId("menu-cenas")).toHaveCount(0);

  const r = await enviarCru(
    jogador.pagina,
    intencaoCrua("cena.importarMapa", {
      id: "cena-invasora",
      nome: "Invasora",
      pxPorQuadrado: 70,
      paredes: [],
      fontes: [],
      assetHash: "a".repeat(64),
    }),
  );
  expect(r?.tipo).toBe("erro");
  expect(r?.dados.codigo).toBe("sem_permissao");
  await expect(mestre.pagina.locator('[data-testid="cena-card"]')).toHaveCount(cenasAntes);
});

const abertos: ClienteMcpHttp[] = [];
test.afterEach(async () => {
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

test("o Claude importa pelo `arquivos` (uso dungeondraft), a cena aparece e o Desfazer a apaga", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await abrirFaixa(mestre.pagina);
  const { token } = await gerarToken(mestre.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);

  const pedido = await mcp.chamar("arquivos", {
    acao: "enviar",
    uso: "dungeondraft",
    nome: "C:\\Mapas\\cripta.dd2vtt",
  });
  expect(pedido.erro, pedido.texto).toBe(false);
  expect(pedido.texto).toContain("mapa Universal VTT");
  const resposta = await enviarPor(linkDoTexto(pedido.texto), dd2vtt());
  expect(resposta.status, resposta.corpo).toBe(200);
  expect(resposta.json?.estado, resposta.corpo).toBe("aplicado");
  expect(resposta.json?.mensagem).toMatch(/Pronto: cripta\.dd2vtt/);
  expect(resposta.json?.mensagem).toContain(RESUMO);

  const cena = () => mcp.chamar("ler", { tipo: "cena", nome: "cripta" });
  await expect.poll(async () => (await cena()).texto).toMatch(/Tamanho: 10 x 10 células/);
  await expect
    .poll(() =>
      mestre.pagina.locator('[data-testid="cena-card"]').filter({ hasText: "cripta" }).count(),
    )
    .toBe(1);
  // O nome guardado é só o nome, e o grupo continua onde estava.
  expect(JSON.stringify(mestre.frames)).not.toContain("C:\\\\Mapas");

  // A cena criada pelo Claude vale no lote dele: o Desfazer a apaga.
  const lotes = await mcp.chamar("desfazer");
  expect(lotes.texto).toMatch(/Enviou mapa Universal VTT/);
  const desfez = await mcp.chamar("desfazer", { acao: "desfazer", lote: "1" });
  expect(desfez.erro, desfez.texto).toBe(false);
  await expect
    .poll(() =>
      mestre.pagina.locator('[data-testid="cena-card"]').filter({ hasText: "cripta" }).count(),
    )
    .toBe(0);

  // Um arquivo que não é um Universal VTT é recusado com o motivo, sem criar cena.
  const ruim = await mcp.chamar("arquivos", { uso: "dungeondraft", nome: "ruim.dd2vtt" });
  const respostaRuim = await enviarPor(
    linkDoTexto(ruim.texto),
    Buffer.from(JSON.stringify({ resolution: { pixels_per_grid: 70 } })),
  );
  expect(respostaRuim.json?.estado, respostaRuim.corpo).toBe("erro");
  expect(respostaRuim.json?.mensagem ?? respostaRuim.corpo).toMatch(/não traz a imagem do mapa/);
});
