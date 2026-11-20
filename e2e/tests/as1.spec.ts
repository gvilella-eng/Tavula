import type { Page } from "@playwright/test";
import {
  abrirAba,
  abrirPreferencia,
  enviarCru,
  escolherCamada,
  expect,
  intencaoCrua,
  type Sessao,
  test,
} from "./ajudas";
import { arquivoPng, assets, gifAnimado, pngDeRuido, soltarArquivoNoMapa } from "./ajudasAssets";
import { gerarToken } from "./ajudasClaude";
import { enviarPor, linkDoTexto } from "./ajudasEnvio";
import { entrarNoMapa } from "./ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "./ajudasMcp";

// AS1: assets da mesa. Soltar um arquivo no mapa vira imagem solta na camada ativa; a lista "Assets da mesa" mostra tudo o que a
// pessoa pode ver; o upload do jogador entra nela com o nome dele; arquivo estranho é recusado; apagar em uso avisa.

const abertos: ClienteMcpHttp[] = [];
test.afterEach(async () => {
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

type ImagemSolta = {
  id: string;
  nome: string;
  x: number;
  y: number;
  camada: string;
  desenhado: boolean;
  selecionado: boolean;
  imagem: {
    larguraM: number;
    alturaM: number;
    rotacao: number;
    figura: boolean;
    quadros: number;
    indice: number;
  } | null;
};

const imagensDe = async (p: Page): Promise<ImagemSolta[]> =>
  (
    await p.evaluate(() =>
      (window as unknown as { __tabletop: { tokens(): unknown[] } }).__tabletop.tokens(),
    )
  ).filter((t) => (t as ImagemSolta).imagem !== null) as ImagemSolta[];

const paginaDoPonto = (p: Page, x: number, y: number) =>
  p.evaluate(
    ([px, py]) =>
      (
        window as unknown as {
          __tabletop: { paginaDoPonto(x: number, y: number): { x: number; y: number } };
        }
      ).__tabletop.paginaDoPonto(px as number, py as number),
    [x, y],
  );

const PNG = () => arquivoPng("estatua.png", pngDeRuido(120, 80, 5, 4));
const GIF = () => ({
  name: "chama.gif",
  mimeType: "image/gif",
  buffer: gifAnimado(8, 8, [
    [255, 0, 0],
    [0, 0, 255],
  ]),
});

/** Dá ao jogador a capacidade de pôr imagens (o mestre, pela mesma intenção da tela) e espera ela chegar. */
async function liberarImagens(mestre: Sessao, jogador: Sessao) {
  const r = await enviarCru(
    mestre.pagina,
    intencaoCrua("permissao.alterar", { capacidade: "imagem.colocar", valor: true }),
  );
  expect(r?.tipo).toBe("evento");
  await expect
    .poll(() => jogador.frames.some((f) => f.includes('"capacidade":"imagem.colocar"')))
    .toBe(true);
}

test("soltar uma imagem e um gif no mapa: vão para a camada ativa, no ponto do soltar, e o jogador vê", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await escolherCamada(mestre.pagina, "mapa");

  await soltarArquivoNoMapa(mestre.pagina, PNG(), await paginaDoPonto(mestre.pagina, 20, 15));
  await expect
    .poll(async () => (await imagensDe(mestre.pagina)).length, { timeout: 30_000 })
    .toBe(1);
  const [img] = await imagensDe(mestre.pagina);
  expect(img?.camada).toBe("mapa");
  expect(img?.x).toBeCloseTo(20, 1);
  expect(img?.y).toBeCloseTo(15, 1);
  // 120 x 80 px a 70 px por quadrado: o tamanho vem da proporção do arquivo
  expect(img?.imagem?.alturaM ?? 0).toBeCloseTo(((img?.imagem?.larguraM ?? 1) * 80) / 120, 1);
  await expect.poll(async () => (await imagensDe(mestre.pagina))[0]?.imagem?.figura).toBe(true);

  // o gif: entra como animação, anima em laço (o quadro muda) e fica onde foi solto
  await soltarArquivoNoMapa(mestre.pagina, GIF(), await paginaDoPonto(mestre.pagina, 30, 20));
  await expect
    .poll(async () => (await imagensDe(mestre.pagina)).length, { timeout: 30_000 })
    .toBe(2);
  const gif = () => imagensDe(mestre.pagina).then((l) => l.find((t) => t.nome === "chama"));
  expect((await gif())?.camada).toBe("mapa");
  expect((await gif())?.x).toBeCloseTo(30, 1);
  await expect.poll(async () => (await gif())?.imagem?.quadros, { timeout: 20_000 }).toBe(2);
  // com "reduzir movimento" (os E2E rodam assim) a animação fica no primeiro quadro; sem ele, troca de quadro em laço
  expect((await gif())?.imagem?.indice).toBe(0);
  await mestre.pagina.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await gif())?.imagem?.indice, { timeout: 15_000 }).toBe(1);
  const tipos = (await assets(mestre.pagina, "metas")).map((m) => m.tipo);
  expect(tipos).toContain("imagem");
  expect(tipos).toContain("animacao");

  // o jogador vê as duas (o arquivo vem do mestre, conferido pelo hash) e o gif anima na tela dele
  for (const nome of ["estatua", "chama"]) {
    await expect
      .poll(
        async () =>
          (await imagensDe(j1.pagina)).find((t) => t.nome === nome)?.imagem?.figura ?? false,
        { timeout: 30_000 },
      )
      .toBe(true);
  }
  expect((await imagensDe(j1.pagina)).find((t) => t.nome === "estatua")?.camada).toBe("mapa");
  expect((await assets(j1.pagina, "verificarCache")).every((c) => c.ok)).toBe(true);
});

test("mover, esticar e girar pelo painel; apagar e desfazer (a imagem solta é um objeto da cena)", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await escolherCamada(p, "tokens");
  await soltarArquivoNoMapa(p, PNG(), await paginaDoPonto(p, 12, 10));
  await expect.poll(async () => (await imagensDe(p)).length, { timeout: 30_000 }).toBe(1);
  const antes = (await imagensDe(p))[0] as ImagemSolta;
  // seleciona e abre o painel (dois cliques), como com um token
  const centro = await paginaDoPonto(p, antes.x, antes.y);
  await p.mouse.dblclick(centro.x, centro.y);
  await expect(p.getByTestId("painel-token")).toBeVisible();
  await expect(p.getByTestId("imagem-largura")).toBeVisible();
  await p.getByTestId("imagem-giro").fill("45");
  await p.getByTestId("imagem-giro").blur();
  await expect.poll(async () => (await imagensDe(p))[0]?.imagem?.rotacao).toBe(45);
  // largura em quadrados (1,5 m cada), proporção travada: a altura acompanha
  await p.getByTestId("imagem-largura").fill("6");
  await p.getByTestId("imagem-largura").blur();
  await expect.poll(async () => (await imagensDe(p))[0]?.imagem?.larguraM).toBeCloseTo(9, 1);
  const depois = (await imagensDe(p))[0] as ImagemSolta;
  expect((depois.imagem?.alturaM ?? 0) / (depois.imagem?.larguraM ?? 1)).toBeCloseTo(
    (antes.imagem?.alturaM ?? 0) / (antes.imagem?.larguraM ?? 1),
    1,
  );
  // arrastar move (sem encaixe no grid)
  await p.mouse.move(centro.x, centro.y);
  await p.mouse.down();
  await p.mouse.move(centro.x + 83, centro.y + 41, { steps: 6 });
  await p.mouse.up();
  await expect
    .poll(async () => {
      const t = (await imagensDe(p))[0];
      return t ? Math.round((t.x - antes.x) * 10) / 10 : null;
    })
    .toBeGreaterThan(1.5);
  // apagar (a tecla Delete, com a imagem selecionada) e o desfazer do aviso
  await p.getByTestId("mapa").focus();
  await p.keyboard.press("Delete");
  await expect.poll(async () => (await imagensDe(p)).length).toBe(0);
  await expect(p.getByTestId("aviso")).toContainText("Imagem removida");
  await p.getByTestId("aviso-acao").click();
  await expect.poll(async () => (await imagensDe(p)).length).toBe(1);
  // camada mestre pelo painel (o botão direito na imagem também o abre)
  const volta = (await imagensDe(p))[0] as ImagemSolta;
  const ondeEsta = await paginaDoPonto(p, volta.x, volta.y);
  await p.mouse.click(ondeEsta.x, ondeEsta.y, { button: "right" });
  await expect(p.getByTestId("painel-token")).toBeVisible();
  await p.getByTestId("token-camada").selectOption("mestre");
  await expect.poll(async () => (await imagensDe(p))[0]?.camada).toBe("mestre");
});

test("as alças da imagem selecionada esticam (proporcional) e giram", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await escolherCamada(p, "tokens");
  await soltarArquivoNoMapa(p, PNG(), await paginaDoPonto(p, 14, 12));
  await expect.poll(async () => (await imagensDe(p)).length, { timeout: 30_000 }).toBe(1);
  const antes = (await imagensDe(p))[0] as ImagemSolta;
  const l0 = antes.imagem?.larguraM ?? 0;
  const a0 = antes.imagem?.alturaM ?? 0;
  const centro = await paginaDoPonto(p, antes.x, antes.y);
  await p.mouse.click(centro.x, centro.y);
  await expect.poll(async () => (await imagensDe(p))[0]?.selecionado).toBe(true);
  // o canto de baixo à direita estica, mantendo a proporção: leva-o ao dobro da distância ao centro
  const canto = await paginaDoPonto(p, antes.x + l0 / 2, antes.y + a0 / 2);
  const alvo = { x: centro.x + (canto.x - centro.x) * 2, y: centro.y + (canto.y - centro.y) * 2 };
  await p.mouse.move(canto.x, canto.y);
  await p.mouse.down();
  await p.mouse.move(alvo.x, alvo.y, { steps: 8 });
  await p.mouse.up();
  await expect.poll(async () => (await imagensDe(p))[0]?.imagem?.larguraM).toBeCloseTo(l0 * 2, 0);
  const esticada = (await imagensDe(p))[0] as ImagemSolta;
  expect((esticada.imagem?.alturaM ?? 0) / (esticada.imagem?.larguraM ?? 1)).toBeCloseTo(
    a0 / l0,
    1,
  );
  // a alça de cima gira: arrastá-la para a direita do centro dá 90 graus
  const a1 = esticada.imagem?.alturaM ?? 0;
  const giro = await paginaDoPonto(p, antes.x, antes.y - a1 / 2 - 26 / 40);
  const aDireita = await paginaDoPonto(p, antes.x + 8, antes.y);
  await p.mouse.move(giro.x, giro.y);
  await p.mouse.down();
  await p.mouse.move(aDireita.x, aDireita.y, { steps: 8 });
  await p.mouse.up();
  await expect.poll(async () => (await imagensDe(p))[0]?.imagem?.rotacao).toBeCloseTo(90, 0);
});

test("o jogador só põe imagem com a capacidade; o upload dele entra nos assets com o nome dele", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const alvo = await paginaDoPonto(j1.pagina, 25, 18);

  // sem a capacidade: aviso, nada entra
  await soltarArquivoNoMapa(j1.pagina, PNG(), alvo);
  await expect(j1.pagina.getByTestId("aviso")).toContainText("Você não pode pôr imagens soltas");
  expect(await imagensDe(j1.pagina)).toHaveLength(0);

  await liberarImagens(mestre, j1);
  await soltarArquivoNoMapa(j1.pagina, PNG(), alvo);
  await expect.poll(async () => (await imagensDe(j1.pagina)).length, { timeout: 30_000 }).toBe(1);
  // o jogador põe na camada dos tokens, no ponto do soltar
  const dele = (await imagensDe(j1.pagina))[0] as ImagemSolta;
  expect(dele.camada).toBe("tokens");
  expect(dele.x).toBeCloseTo(25, 1);
  // o mestre vê a imagem e o arquivo na lista, "enviado por Jogador 1"
  await expect
    .poll(async () => (await imagensDe(mestre.pagina)).length, { timeout: 30_000 })
    .toBe(1);
  await abrirAba(mestre.pagina, "mesa");
  const linha = mestre.pagina.locator('[data-testid^="asset-"][data-tipo="imagem"]');
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText("enviado por Jogador 1");
  await expect(linha).toContainText("imagem solta estatua");
  await expect(linha).toHaveAttribute("data-dono", "jogador-1");
  // o jogador acha o arquivo dele na própria lista (Preferências), com "enviado por você"
  await abrirPreferencia(j1.pagina, "assets");
  await expect(j1.pagina.locator('[data-testid^="asset-"][data-tipo="imagem"]')).toContainText(
    "enviado por você",
  );
});

test("a seção de assets lista os tipos, filtra, busca e ordena; arrastar da lista para o mapa põe na cena", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await escolherCamada(p, "mapa");
  await soltarArquivoNoMapa(p, PNG(), await paginaDoPonto(p, 20, 15));
  await soltarArquivoNoMapa(p, GIF(), await paginaDoPonto(p, 30, 20));
  await expect.poll(async () => (await imagensDe(p)).length, { timeout: 30_000 }).toBe(2);
  // um som e um mapa registrados (só a meta: o que importa aqui é a lista)
  const meta = (hash: string, tipo: string, nome: string, mime: string) => ({
    hash,
    tipo,
    mime,
    bytes: 100,
    largura: 100,
    altura: 100,
    nomeOriginal: nome,
    pedacos: ["1".repeat(64)],
  });
  const HSOM = "5".repeat(64);
  const HMAPA = "6".repeat(64);
  const r = await enviarCru(
    p,
    intencaoCrua("asset.registrar", { metas: [meta(HSOM, "som", "trovao.mp3", "audio/mpeg")] }),
  );
  expect(r?.tipo).toBe("evento");
  await enviarCru(
    p,
    intencaoCrua("asset.registrar", {
      metas: [meta(HMAPA, "mapa", "catacumba.png", "image/webp")],
    }),
  );

  await abrirAba(p, "mesa");
  const contagem = p.getByTestId("assets-contagem");
  await expect(contagem).toContainText("4 arquivos");
  for (const tipo of ["imagem", "animacao", "som", "mapa"]) {
    await expect(p.locator(`[data-testid^="asset-"][data-tipo="${tipo}"]`)).toHaveCount(1);
  }
  // filtro por tipo
  await p.getByTestId("assets-tipo").selectOption("animacao");
  await expect(contagem).toContainText("1 de 4");
  await expect(p.locator('[data-testid^="asset-"][data-tipo="animacao"]')).toContainText(
    "Animação",
  );
  await p.getByTestId("assets-tipo").selectOption("todas");
  // busca (sem acento nem caixa) e por onde é usado
  await p.getByTestId("assets-busca").fill("TROVAO");
  await expect(contagem).toContainText("1 de 4");
  await p.getByTestId("assets-busca").fill("imagem solta estatua");
  await expect(contagem).toContainText("1 de 4");
  await p.getByTestId("assets-busca").fill("");
  // ordem por tamanho: o maior primeiro
  await p.getByTestId("assets-ordem-tamanho").click();
  const nomes = await p.locator(".asset-nome").allTextContents();
  expect(nomes).toHaveLength(4);
  // quem enviou
  await expect(p.getByTestId("assets-dono").locator("option")).toHaveCount(2);

  // arrastar o arquivo da lista para o mapa põe outra imagem na cena, onde soltou
  const hashDoPng = (await assets(p, "metas")).find((m) => m.tipo === "imagem")?.hash ?? "";
  const linha = p.getByTestId(`asset-${hashDoPng.slice(0, 12)}`);
  await expect(linha).toBeVisible();
  const mapaCaixa = await p.getByTestId("mapa").boundingBox();
  const caixa = mapaCaixa ?? { x: 0, y: 0, width: 800, height: 500 };
  const alvoNaPagina = { x: caixa.x + caixa.width * 0.35, y: caixa.y + caixa.height * 0.4 };
  const alvoM = await p.evaluate(
    ([x, y]) =>
      (
        window as unknown as {
          __tabletop: { metrosDaPagina(x: number, y: number): { x: number; y: number } };
        }
      ).__tabletop.metrosDaPagina(x as number, y as number),
    [alvoNaPagina.x, alvoNaPagina.y],
  );
  await linha.dragTo(p.getByTestId("mapa"), {
    targetPosition: { x: caixa.width * 0.35, y: caixa.height * 0.4 },
  });
  await expect.poll(async () => (await imagensDe(p)).length, { timeout: 20_000 }).toBe(3);
  const nova = (await imagensDe(p)).find(
    (t) => Math.abs(t.x - alvoM.x) < 0.6 && Math.abs(t.y - alvoM.y) < 0.6,
  );
  expect(nova?.camada).toBe("mapa");
});

test("o jogador não vê o mapa escondido nem os sons do mestre (nem nos frames)", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const meta = (hash: string, tipo: string, nome: string, mime: string) => ({
    hash,
    tipo,
    mime,
    bytes: 100,
    largura: 100,
    altura: 100,
    nomeOriginal: nome,
    pedacos: ["1".repeat(64)],
  });
  const HSOM = "7".repeat(64);
  const HMAPA = "8".repeat(64);
  await enviarCru(
    mestre.pagina,
    intencaoCrua("asset.registrar", {
      metas: [meta(HSOM, "som", "trovao-secreto.mp3", "audio/mpeg")],
    }),
  );
  await enviarCru(
    mestre.pagina,
    intencaoCrua("asset.registrar", {
      metas: [meta(HMAPA, "mapa", "covil-escondido.png", "image/webp")],
    }),
  );
  // o mapa vai para uma cena que o grupo não vê; o som para a mesa de som
  const m = await enviarCru(
    mestre.pagina,
    intencaoCrua("cena.definirMapa", { cenaId: "cena-covil", assetHash: HMAPA }),
  );
  expect(m?.tipo).toBe("evento");
  await enviarCru(
    mestre.pagina,
    intencaoCrua("som.lugar", {
      grupo: "ambiente",
      indice: 0,
      lugar: { hash: HSOM, nome: "Trovão", icone: "trovao", cor: "ambar", volume: 0.5 },
    }),
  );

  // o mestre vê os dois na lista, com o uso
  await abrirAba(mestre.pagina, "mesa");
  await expect(mestre.pagina.getByTestId(`asset-${HMAPA.slice(0, 12)}`)).toContainText(
    "mapa da cena Covil",
  );
  await expect(mestre.pagina.getByTestId(`asset-${HSOM.slice(0, 12)}`)).toContainText(
    "mesa de som",
  );
  // o jogador abre a lista dele: nenhum dos dois, e a sala não mandou nada deles
  await abrirPreferencia(j1.pagina, "assets");
  await expect.poll(() => j1.frames.some((f) => f.includes('"tipo":"assets.lista"'))).toBe(true);
  await expect(j1.pagina.getByTestId("assets-lista")).not.toContainText("trovao-secreto");
  await expect(j1.pagina.getByTestId("assets-lista")).not.toContainText("covil-escondido");
  expect(j1.frames.some((f) => f.includes("trovao-secreto") || f.includes("covil-escondido"))).toBe(
    false,
  );
  // pedir o arquivo escondido pelo hash também não revela nada
  const pedido = await enviarCru(j1.pagina, intencaoCrua("asset.pedir", { hash: HMAPA }));
  expect(pedido?.dados.codigo).toBe("asset_inexistente");
});

test("apagar um asset em uso avisa onde; confirmar tira a imagem da cena; o desfazer traz o arquivo de volta", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await escolherCamada(p, "mapa");
  await soltarArquivoNoMapa(p, PNG(), await paginaDoPonto(p, 20, 15));
  await expect.poll(async () => (await imagensDe(p)).length, { timeout: 30_000 }).toBe(1);
  const hash = (await assets(p, "metas")).find((m) => m.tipo === "imagem")?.hash ?? "";
  const h = hash.slice(0, 12);
  await abrirAba(p, "mesa");
  await expect(p.getByTestId(`asset-uso-${h}`)).toContainText("imagem solta estatua");

  await p.getByTestId(`asset-apagar-${h}`).click();
  const aviso = p.getByTestId(`asset-aviso-${h}`);
  await expect(aviso).toContainText("está em uso em");
  await expect(aviso).toContainText("imagem solta estatua");
  // cancelar deixa tudo como estava
  await p.getByTestId(`asset-apagar-cancelar-${h}`).click();
  await expect(aviso).toHaveCount(0);
  expect(await imagensDe(p)).toHaveLength(1);

  await p.getByTestId(`asset-apagar-${h}`).click();
  await p.getByTestId(`asset-apagar-confirmar-${h}`).click();
  await expect.poll(async () => (await imagensDe(p)).length).toBe(0);
  await expect(p.getByTestId(`asset-${h}`)).toHaveCount(0);
  // o desfazer do aviso traz o arquivo de volta (a imagem na cena não volta: o arquivo, sim)
  await p.getByTestId("aviso-acao").click();
  await expect(p.getByTestId(`asset-${h}`)).toHaveCount(1);
  await expect(p.getByTestId(`asset-uso-${h}`)).toContainText("Sem uso");
  // sem uso, apagar pede só uma confirmação
  await p.getByTestId(`asset-apagar-${h}`).click();
  await expect(p.getByTestId(`asset-aviso-${h}`)).toContainText("Apagar");
  await p.getByTestId(`asset-apagar-confirmar-${h}`).click();
  await expect(p.getByTestId(`asset-${h}`)).toHaveCount(0);
});

test("renomear muda o nome mostrado (não o arquivo); o mestre vê o nome novo", async ({ mesa }) => {
  test.setTimeout(60_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await soltarArquivoNoMapa(p, PNG(), await paginaDoPonto(p, 20, 15));
  await expect.poll(async () => (await imagensDe(p)).length, { timeout: 30_000 }).toBe(1);
  const hash = (await assets(p, "metas")).find((m) => m.tipo === "imagem")?.hash ?? "";
  const h = hash.slice(0, 12);
  await abrirAba(p, "mesa");
  await p.getByTestId(`asset-renomear-${h}`).click();
  await p.getByTestId(`asset-nome-${h}`).fill("Estátua da praça");
  await p.getByTestId(`asset-nome-${h}`).press("Enter");
  await expect(p.getByTestId(`asset-${h}`).locator(".asset-nome")).toHaveText("Estátua da praça");
  // o nome original do arquivo continua nos metadados
  expect((await assets(p, "metas")).find((m) => m.hash === hash)?.nomeOriginal).toBe("estatua.png");
});

test("segurança: um .png que é um programa e um SVG são recusados; o tipo vem dos bytes", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await liberarImagens(mestre, j1);
  const alvo = await paginaDoPonto(j1.pagina, 25, 18);
  const exe = Buffer.concat([
    Buffer.from("MZ\u0090\u0000\u0003\u0000\u0000\u0000"),
    Buffer.alloc(200),
  ]);
  await soltarArquivoNoMapa(
    j1.pagina,
    { name: "foto.png", mimeType: "image/png", buffer: exe },
    alvo,
  );
  await expect(j1.pagina.getByTestId("aviso")).toContainText("programa do Windows");
  const svg = Buffer.from(
    "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script><rect width='9' height='9'/></svg>",
  );
  await soltarArquivoNoMapa(
    j1.pagina,
    { name: "bonito.svg", mimeType: "image/svg+xml", buffer: svg },
    alvo,
  );
  await expect(j1.pagina.getByTestId("aviso")).toContainText("SVG");
  expect(await imagensDe(j1.pagina)).toHaveLength(0);
  expect(await imagensDe(mestre.pagina)).toHaveLength(0);
  // a sala também recusa uma meta que declara um tipo fora da lista (mesmo vinda de um cliente que não passou pela tela)
  const ruim = await enviarCru(
    j1.pagina,
    intencaoCrua("asset.registrar", {
      metas: [
        {
          hash: "9".repeat(64),
          tipo: "imagem",
          mime: "image/svg+xml",
          bytes: 100,
          largura: 10,
          altura: 10,
          nomeOriginal: "x.svg",
          pedacos: ["1".repeat(64)],
        },
      ],
    }),
  );
  expect(ruim?.dados.codigo).toBe("dados_invalidos");
});

test("a pasta do mestre: assets/<quem enviou>/<tipo>/<nome>-<hash>, a imagem do jogador regravada, e de onde carregar (medido)", async ({
  mesa,
}) => {
  test.setTimeout(150_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await assets(mestre.pagina, "simularPasta", "autorizada");
  await liberarImagens(mestre, j1);

  // o mestre sobe uma imagem e um som (só a meta); o jogador sobe outra
  await soltarArquivoNoMapa(mestre.pagina, PNG(), await paginaDoPonto(mestre.pagina, 20, 15));
  await soltarArquivoNoMapa(
    j1.pagina,
    arquivoPng("dado.png", pngDeRuido(300, 200, 9, 4)),
    await paginaDoPonto(j1.pagina, 25, 18),
  );
  await expect
    .poll(async () => (await imagensDe(mestre.pagina)).length, { timeout: 40_000 })
    .toBe(2);
  const metas = await assets(mestre.pagina, "metas");
  const doMestre = metas.find((m) => m.nomeOriginal === "estatua.png");
  const doJogador = metas.find((m) => m.nomeOriginal === "dado.png");
  expect(doMestre?.donoId).toBe("mestre");
  expect(doJogador?.donoId).toBe("jogador-1");

  await expect
    .poll(async () => (await assets(mestre.pagina, "gravados")).map((g) => g.caminho), {
      timeout: 30_000,
    })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^assets\/Mestre\/imagens\/estatua-[0-9a-f]{8}\.webp$/),
        expect.stringMatching(/^assets\/Jogador 1\/imagens\/dado-[0-9a-f]{8}\.webp$/),
        `arquivos-da-mesa/${doMestre?.hash}`,
        `arquivos-da-mesa/${doJogador?.hash}`,
      ]),
    );
  const gravados = await assets(mestre.pagina, "gravados");
  // o que é do mestre vai como está; o que é do jogador foi decodificado e regravado (bytes do mestre, não os dele)
  const organizadoDoMestre = gravados.find((g) => g.caminho.startsWith("assets/Mestre/imagens/"));
  const organizadoDoJogador = gravados.find((g) =>
    g.caminho.startsWith("assets/Jogador 1/imagens/"),
  );
  expect(organizadoDoMestre?.sha256).toBe(doMestre?.hash);
  expect(organizadoDoJogador?.sha256).not.toBe(doJogador?.hash);
  // nenhum nome com extensão executável nem com `..` ou barra no nome do arquivo
  for (const g of gravados) {
    expect(g.caminho).not.toMatch(/\.\.|\.(exe|bat|cmd|ps1|lnk|scr|hta|js|vbs|svg|html)$/i);
  }

  // de onde carregar: o jogador baixou da rede (do mestre); o que já está no cache lê do próprio computador, mais rápido
  const hashDoMestre = doMestre?.hash ?? "";
  await expect
    .poll(() => assets(j1.pagina, "pronto", hashDoMestre), { timeout: 30_000 })
    .toBe(true);
  const rede = (await assets(j1.pagina, "medidasDeCarga")).find(
    (m) => m.hash === hashDoMestre && m.origem === "rede",
  );
  expect(rede).toBeDefined();
  const cache = await assets(j1.pagina, "lerDoCacheMedindo", hashDoMestre);
  expect(cache?.origem).toBe("cache");
  console.log(
    `[AS1] ${hashDoMestre.slice(0, 8)}: rede ${rede?.ms.toFixed(1)} ms, cache ${cache?.ms.toFixed(1)} ms (${rede?.bytes} bytes)`,
  );
  expect(cache?.ms ?? 1e9).toBeLessThan(rede?.ms ?? 0);

  // outro navegador do mestre, com a mesma pasta: lê da pasta, sem rede
  const pasta = await assets(mestre.pagina, "exportarPasta");
  // "fechei": ninguém com o arquivo está online; só a pasta o tem
  await mestre.contexto.close();
  await j1.contexto.close();
  const segundo = await mesa.entrar("mestre");
  await assets(segundo.pagina, "importarPasta", pasta);
  await assets(segundo.pagina, "simularPasta", "autorizada");
  await expect
    .poll(() => assets(segundo.pagina, "pronto", hashDoMestre), { timeout: 30_000 })
    .toBe(true);
  const dapasta = (await assets(segundo.pagina, "medidasDeCarga")).find(
    (m) => m.hash === hashDoMestre,
  );
  console.log(
    `[AS1] segundo navegador do mestre: origem ${dapasta?.origem}, ${dapasta?.ms.toFixed(1)} ms`,
  );
  expect(dapasta?.origem).toBe("pasta");
});

test("o Claude põe uma imagem na cena pelo MCP, lista os assets, ajusta, renomeia e apaga com as mesmas regras", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { token } = await gerarToken(mestre.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);

  const pedido = await mcp.chamar("arquivos", {
    acao: "enviar",
    uso: "imagem",
    nome: "C:\\Users\\mestre\\estatua.png",
    x: 10,
    y: 8,
    camada: "mapa",
    larguraQuadrados: 3,
  });
  expect(pedido.erro, pedido.texto).toBe(false);
  const resposta = await enviarPor(linkDoTexto(pedido.texto), pngDeRuido(120, 80, 5, 4));
  expect(resposta.json?.estado, resposta.corpo).toBe("aplicado");
  expect(resposta.json?.mensagem).toMatch(/a imagem foi posta na cena/i);
  await expect
    .poll(async () => (await imagensDe(mestre.pagina)).length, { timeout: 30_000 })
    .toBe(1);
  const [img] = await imagensDe(mestre.pagina);
  // 10 e 8 quadrados de 1,5 m; 3 quadrados de largura; a camada pedida; o nome sem o caminho do computador
  expect(img?.x).toBeCloseTo(15, 1);
  expect(img?.y).toBeCloseTo(12, 1);
  expect(img?.camada).toBe("mapa");
  expect(img?.imagem?.larguraM).toBeCloseTo(4.5, 1);
  expect(img?.nome).toBe("estatua");

  const lista = await mcp.chamar("arquivos", { acao: "listar" });
  expect(lista.texto).toMatch(
    /estatua\.png \(imagem.*enviado por Mestre.*usado em: imagem solta estatua/,
  );

  const ajuste = await mcp.chamar("arquivos", {
    acao: "ajustar",
    token: "estatua",
    rotacao: 30,
    x: 20,
  });
  expect(ajuste.erro, ajuste.texto).toBe(false);
  await expect.poll(async () => (await imagensDe(mestre.pagina))[0]?.imagem?.rotacao).toBe(30);
  await expect.poll(async () => (await imagensDe(mestre.pagina))[0]?.x).toBeCloseTo(30, 1);

  const hash = (await assets(mestre.pagina, "metas")).find((m) => m.tipo === "imagem")?.hash ?? "";
  const nome = await mcp.chamar("arquivos", {
    acao: "renomear",
    hash: hash.slice(0, 8),
    novoNome: "Estátua da praça",
  });
  expect(nome.erro, nome.texto).toBe(false);
  await abrirAba(mestre.pagina, "mesa");
  await expect(mestre.pagina.getByTestId(`asset-${hash.slice(0, 12)}`)).toContainText(
    "Estátua da praça",
  );

  // em uso: recusa e diz onde; confirmado, tira a imagem da cena
  const recusado = await mcp.chamar("arquivos", { acao: "apagar", hash: hash.slice(0, 8) });
  expect(recusado.erro).toBe(true);
  expect(recusado.texto).toMatch(/em uso em: imagem solta/i);
  const feito = await mcp.chamar("arquivos", {
    acao: "apagar",
    hash: hash.slice(0, 8),
    confirmar: true,
  });
  expect(feito.erro, feito.texto).toBe(false);
  await expect.poll(async () => (await imagensDe(mestre.pagina)).length).toBe(0);
});
