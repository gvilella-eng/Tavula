import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, esperarMapa, expect, intencaoCrua, type Mesa, test } from "./ajudas";
import {
  arquivoPng,
  assets,
  definirMapa,
  escolherNoSeletor,
  esperarPronto,
  imagemDoTokenSelecionado,
  imagensDoMapa,
  type MetaVista,
  metaPorNome,
  pngDeRuido,
} from "./ajudasAssets";
import { abrirPainelDoToken, criarToken } from "./ajudasMapa";

// Os assets são locais: o servidor só repassa bytes. Aqui cada contexto do Playwright é "outro PC"
// (cache OPFS próprio). As imagens são geradas no teste; o limite do tile é reduzido por gancho
// para fatiar um mapa pequeno.

type Gancho = {
  tokens(): { id: string; x: number; y: number }[];
  paraTela(x: number, y: number): { x: number; y: number };
  centrarEm(x: number, y: number): void;
  definirZoom(z: number): void;
};

/** Entra, espera o mapa subir e deixa a vista em zoom 1. */
async function entrarNoMapa(mesa: Mesa, usuario: string, gancho?: Parameters<Mesa["entrar"]>[1]) {
  const s = await mesa.entrar(usuario, gancho);
  await esperarMapa(s.pagina);
  await s.pagina.evaluate(() =>
    (window as unknown as { __tabletop: Gancho }).__tabletop.definirZoom(1),
  );
  return s;
}

/** Dois cliques no token (mouse de verdade): seleciona e abre o painel do token do mestre (R5a). */
async function selecionarToken(p: Page, id: string) {
  const alvo = await p.evaluate((tid) => {
    const h = (window as unknown as { __tabletop: Gancho }).__tabletop;
    const t = h.tokens().find((x) => x.id === tid);
    if (!t) throw new Error(`token ${tid} não está visível`);
    h.centrarEm(t.x, t.y);
    return h.paraTela(t.x, t.y);
  }, id);
  await p.mouse.dblclick(alvo.x, alvo.y);
  await expect(p.getByTestId("painel-token")).toBeVisible();
}

const totalDePedacos = (metas: MetaVista[], manifesto: MetaVista) =>
  (manifesto.tiles ?? []).reduce(
    (soma, t) => soma + (metas.find((m) => m.hash === t.hash)?.pedacos.length ?? 0),
    0,
  );

const JOGADORES = [
  "jogador-1",
  "jogador-2",
  "jogador-3",
  "jogador-4",
  "jogador-5",
  "jogador-6",
  "jogador-7",
];

test("o mestre põe um mapa fatiado: os 7 jogadores recebem os tiles, o hash bate e o dono envia só uma vez", async ({
  mesa,
}) => {
  test.setTimeout(150_000);
  // Limite de tile reduzido (512 px) e envio lento: os 7 pedidos chegam antes do primeiro pedaço.
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512, atrasoPorPedacoMs: 300 });
  const jogadores = [];
  for (const j of JOGADORES) jogadores.push(await entrarNoMapa(mesa, j));

  await definirMapa(
    mestre.pagina,
    "cena-1",
    arquivoPng("masmorra.png", pngDeRuido(1200, 800, 7, 2)),
  );

  const manifesto = await metaPorNome(mestre.pagina, "masmorra.png");
  expect(manifesto.tipo).toBe("mapa");
  expect(manifesto.tiles).toHaveLength(6); // 1200 x 800 com tiles de até 512 px: 3 x 2
  const metas = await assets(mestre.pagina, "metas");
  const tiles = metas.filter((m) => m.tipo === "tile");
  expect(tiles).toHaveLength(6);
  const pedacosNoTotal = totalDePedacos(metas, manifesto);
  expect(pedacosNoTotal).toBeGreaterThanOrEqual(6);
  for (const t of tiles) expect(t.largura).toBeLessThanOrEqual(512);

  for (const j of jogadores) {
    await esperarPronto(j.pagina, manifesto.hash);
    // o hash bate: relê cada arquivo do OPFS e recalcula o SHA-256
    const cache = await assets(j.pagina, "verificarCache");
    expect(cache.every((c) => c.ok)).toBe(true);
    expect(cache.map((c) => c.hash).sort()).toEqual(tiles.map((t) => t.hash).sort());
    // o fundo mostra os 6 tiles, na escala px ÷ pxPorQuadrado × quadradoM (1200 px = 25,7 m)
    await expect
      .poll(async () => (await imagensDoMapa(j.pagina)).tiles.length)
      .toBe(manifesto.tiles?.length ?? -1);
    const sprites = (await imagensDoMapa(j.pagina)).tiles;
    const direita = Math.max(...sprites.map((s) => s.x + s.largura));
    expect(direita).toBeCloseTo((1200 / 70) * 1.5 * 40, 1);
    expect(j.binarios.length).toBeGreaterThanOrEqual(pedacosNoTotal);
  }

  // o mestre enviou cada pedaço uma vez só (a sala repassou a todos), não sete
  expect(mestre.enviadosBinarios.length).toBeGreaterThanOrEqual(pedacosNoTotal);
  expect(mestre.enviadosBinarios.length).toBeLessThan(pedacosNoTotal * 3);
});

test("segunda carga da página: zero pedaços binários (veio do cache OPFS)", async ({ mesa }) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await definirMapa(mestre.pagina, "cena-1", arquivoPng("sala.png", pngDeRuido(900, 700, 3, 2)));
  const manifesto = await metaPorNome(mestre.pagina, "sala.png");
  await esperarPronto(j1.pagina, manifesto.hash);
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tiles.length)
    .toBe(manifesto.tiles?.length ?? -1);
  const antes = j1.binarios.length;
  expect(antes).toBeGreaterThan(0);
  const pedidosAntes = j1.enviados.filter((f) => f.includes('"tipo":"asset.pedir"')).length;

  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await esperarMapa(j1.pagina);
  // o mapa volta inteiro, vindo do cache local
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tiles.length)
    .toBe(manifesto.tiles?.length ?? -1);
  await esperarPronto(j1.pagina, manifesto.hash);
  // dá tempo de qualquer pedido atrasado chegar
  await j1.pagina.waitForTimeout(1500);
  expect(j1.binarios.length).toBe(antes);
  // nem pediu nada à sala: tudo estava no cache
  expect(j1.enviados.filter((f) => f.includes('"tipo":"asset.pedir"'))).toHaveLength(pedidosAntes);
  const inventario = j1.enviados.filter((f) => f.includes('"tipo":"asset.inventario"'));
  expect(inventario.length).toBeGreaterThanOrEqual(2); // uma por conexão
  expect(inventario.at(-1)).toContain(manifesto.tiles?.[0]?.hash ?? "?");
});

test("o mestre sai: um jogador novo recebe o mapa de outro jogador que já tinha cópia", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await definirMapa(mestre.pagina, "cena-1", arquivoPng("cripta.png", pngDeRuido(1000, 600, 5, 2)));
  const manifesto = await metaPorNome(mestre.pagina, "cripta.png");
  await esperarPronto(j1.pagina, manifesto.hash);

  // o mestre vai embora: a sala segue, o jogador 1 vê o mestre offline
  await mestre.contexto.close();
  await abrirAba(j1.pagina, "chat");
  await expect(j1.pagina.getByTestId("presenca-estado-mestre")).not.toHaveText("online", {
    timeout: 20_000,
  });
  const enviadosPeloJ1Antes = j1.enviadosBinarios.length;

  // jogador novo, sem cache nenhum: o mapa vem do jogador 1
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await esperarPronto(j2.pagina, manifesto.hash);
  const cache = await assets(j2.pagina, "verificarCache");
  expect(cache.length).toBe(manifesto.tiles?.length ?? -1);
  expect(cache.every((c) => c.ok)).toBe(true);
  expect(j2.binarios.length).toBeGreaterThan(0);
  expect(j1.enviadosBinarios.length).toBeGreaterThan(enviadosPeloJ1Antes);
  await expect
    .poll(async () => (await imagensDoMapa(j2.pagina)).tiles.length)
    .toBe(manifesto.tiles?.length ?? -1);
});

test("pedaço corrompido é detectado e pedido de novo; o asset termina íntegro", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  // o dono corrompe o pedaço 1 da primeira vez que o envia
  const mestre = await entrarNoMapa(mesa, "mestre", { corromperIndice: 1, corromperVezes: 1 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await definirMapa(mestre.pagina, "cena-1", arquivoPng("grande.png", pngDeRuido(900, 700, 11, 1)));
  const meta = await metaPorNome(mestre.pagina, "grande.png");
  expect(meta.tiles).toBeUndefined(); // sem fatiar: um arquivo só
  expect(meta.pedacos.length).toBeGreaterThanOrEqual(3);

  await esperarPronto(j1.pagina, meta.hash);
  const cache = await assets(j1.pagina, "verificarCache");
  expect(cache).toEqual([{ hash: meta.hash, ok: true, bytes: meta.bytes }]);
  // o pedaço 1 foi pedido de novo, sozinho
  const repetidos = j1.enviados.filter(
    (f) => f.includes('"tipo":"asset.pedir"') && f.includes('"faltam":[1]'),
  );
  expect(repetidos).toHaveLength(1);
  // chegaram os pedaços todos + o reenviado
  expect(j1.binarios.length).toBe(meta.pedacos.length + 1);
});

test("refresh no meio de uma transferência: retoma do que já estava no cache e termina", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre", { atrasoPorPedacoMs: 1200 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await definirMapa(mestre.pagina, "cena-1", arquivoPng("lento.png", pngDeRuido(900, 700, 13, 1)));
  const meta = await metaPorNome(mestre.pagina, "lento.png");
  const total = meta.pedacos.length;
  expect(total).toBeGreaterThanOrEqual(3);

  // espera chegar pelo menos um pedaço, mas não todos, e dá refresh
  let recebidos = 0;
  await expect
    .poll(async () => {
      const s = (await assets(j1.pagina, "status")).find((x) => x.hash === meta.hash);
      recebidos = s?.recebidos ?? 0;
      return recebidos >= 1 && recebidos < total;
    })
    .toBe(true);
  const antes = j1.binarios.length;
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("status-conexao")).toHaveText("conectado");

  await esperarPronto(j1.pagina, meta.hash);
  const cache = await assets(j1.pagina, "verificarCache");
  expect(cache).toEqual([{ hash: meta.hash, ok: true, bytes: meta.bytes }]);
  // retomou: depois do refresh só vieram os pedaços que faltavam
  const depois = j1.binarios.length - antes;
  expect(depois).toBeLessThanOrEqual(total - recebidos);
  expect(depois).toBeGreaterThanOrEqual(1);
});

test("o jogador põe imagem no próprio token: aparece para todos e chega a recebidos/<jogador> do mestre", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");

  // o Aldric (tok-jogador-1) é do jogador 1; sem imagem ainda
  expect((await imagensDoMapa(j2.pagina)).tokensComImagem).toEqual([]);
  // quem edita o personagem troca o token dele no editor do item (Fichas)
  await abrirAba(j1.pagina, "fichas");
  await j1.pagina.getByTestId("ficha-abrir-pers-aldric").dblclick();
  await j1.pagina.getByTestId("ficha-aba-configurar").click();
  await j1.pagina.getByTestId("editor-token").click();
  await escolherNoSeletor(j1.pagina, arquivoPng("aldric.png", pngDeRuido(300, 300, 21, 4)));
  const meta = await metaPorNome(j1.pagina, "aldric.png");
  expect(meta.tipo).toBe("token");
  expect(meta.largura).toBeLessThanOrEqual(512);

  for (const p of [j1.pagina, j2.pagina, mestre.pagina]) {
    await expect
      .poll(async () => (await imagensDoMapa(p)).tokensComImagem)
      .toContain("tok-jogador-1");
    await esperarPronto(p, meta.hash);
  }
  // o jogador 2 recebeu o arquivo do dono (jogador 1) e conferiu o hash
  expect((await assets(j2.pagina, "verificarCache")).every((c) => c.ok)).toBe(true);

  // o navegador do mestre gravou a cópia em recebidos/Jogador 1/ (a Memoria faz o papel da pasta)
  await expect
    .poll(async () => (await assets(mestre.pagina, "gravados")).length, { timeout: 20_000 })
    .toBe(1);
  const [copia] = await assets(mestre.pagina, "gravados");
  expect(copia?.caminho.startsWith("recebidos/Jogador 1/aldric-")).toBe(true);
  expect(copia?.caminho.endsWith(".webp")).toBe(true);
  expect(copia?.sha256).toBe(meta.hash);
  expect(copia?.bytes).toBe(meta.bytes);
});

/** O mestre põe uma imagem no goblin oculto e outra no ogro (visível); devolve os dois hashes. */
async function imagensNoGoblinENoOgro(mestre: Page) {
  await selecionarToken(mestre, "tok-goblin-oculto");
  await imagemDoTokenSelecionado(mestre, arquivoPng("goblin.png", pngDeRuido(200, 200, 31, 4)));
  const goblin = await metaPorNome(mestre, "goblin.png");

  await selecionarToken(mestre, "tok-ogro");
  await imagemDoTokenSelecionado(mestre, arquivoPng("ogro.png", pngDeRuido(200, 200, 32, 4)));
  const ogro = await metaPorNome(mestre, "ogro.png");
  return { goblin, ogro };
}

test("frames do jogador nunca têm o hash nem os pedaços da imagem do goblin oculto", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const { goblin, ogro } = await imagensNoGoblinENoOgro(mestre.pagina);

  // controle positivo: a imagem do ogro (visível) chega ao jogador, em texto e em bytes
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tokensComImagem)
    .toContain("tok-ogro");
  await esperarPronto(j1.pagina, ogro.hash);
  // o mestre já tem a do goblin; confirma que ela existe e está no cache dele
  await esperarPronto(mestre.pagina, goblin.hash);
  await j1.pagina.waitForTimeout(1000);

  const hashDoGoblin = goblin.hash;
  const inicioDoGoblin = await assets(mestre.pagina, "inicioDe", goblin.hash, 64);
  const inicioDoOgro = await assets(mestre.pagina, "inicioDe", ogro.hash, 64);
  expect(inicioDoGoblin).not.toBeNull();
  const cru = (hex: string | null) => Buffer.from(hex ?? "", "hex");

  const textos = j1.frames.join("\n");
  expect(textos).toContain(ogro.hash);
  expect(j1.binarios.some((b) => b.includes(Buffer.from(ogro.hash, "hex")))).toBe(true);
  expect(j1.binarios.some((b) => b.includes(cru(inicioDoOgro)))).toBe(true);

  // nada do goblin: nem hash (texto ou binário), nem pedaço do arquivo, nem meta
  expect(textos).not.toContain(hashDoGoblin);
  expect(textos).not.toContain("goblin.png");
  expect(j1.binarios.some((b) => b.includes(Buffer.from(hashDoGoblin, "hex")))).toBe(false);
  expect(j1.binarios.some((b) => b.includes(cru(inicioDoGoblin)))).toBe(false);
  expect(j1.binarios.some((b) => b.toString("latin1").includes(hashDoGoblin))).toBe(false);
  // o próprio jogador não tem o arquivo no cache
  expect(await assets(j1.pagina, "inventario")).not.toContain(hashDoGoblin);

  // o mestre revela o goblin: aí a imagem passa a chegar
  await selecionarToken(mestre.pagina, "tok-goblin-oculto");
  await mestre.pagina.getByTestId("token-oculto").click();
  await expect(mestre.pagina.getByTestId("token-oculto")).not.toBeChecked();
  await esperarPronto(j1.pagina, goblin.hash);
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tokensComImagem)
    .toContain("tok-goblin-oculto");
});

test("jogador pedindo o hash de um asset que não vê recebe a mesma resposta de um que não existe", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const { goblin } = await imagensNoGoblinENoOgro(mestre.pagina);
  await esperarPronto(mestre.pagina, goblin.hash);

  const pedir = (hash: string) => enviarCru(j1.pagina, intencaoCrua("asset.pedir", { hash }));
  const doGoblin = await pedir(goblin.hash);
  const inexistente = await pedir("ab".repeat(32));
  expect(doGoblin).not.toBeNull();
  // a mesma resposta (só o id do pedido, que é de cada pedido, difere)
  const semId = (r: typeof doGoblin) => ({ ...r, dados: { ...r?.dados, idPedido: undefined } });
  expect(semId(doGoblin)).toEqual(semId(inexistente));
  expect(doGoblin?.tipo).toBe("erro");
  expect(doGoblin?.dados.codigo).toBe("asset_inexistente");
  // sem o frame ter chegado: o jogador nunca recebeu meta nem pedaço
  expect(j1.frames.join("\n")).not.toContain(goblin.hash);
});

test("anunciar que tem um asset que não vê não faz o jogador servir esse arquivo", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const { goblin } = await imagensNoGoblinENoOgro(mestre.pagina);
  await esperarPronto(mestre.pagina, goblin.hash);

  // o jogador (que de algum jeito soube o hash) abre uma conexão própria, que fica aberta, e diz
  // que tem a imagem do goblin oculto; tudo o que chegar nela fica guardado
  const anuncios = [
    intencaoCrua("asset.tenho", { hash: goblin.hash }),
    intencaoCrua("asset.inventario", { hashes: [goblin.hash] }),
  ];
  await j1.pagina.evaluate((textos) => {
    const w = window as unknown as { __espiao: string[]; __espiaoAberto: boolean };
    w.__espiao = [];
    w.__espiaoAberto = false;
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      for (const t of textos) ws.send(t);
      w.__espiaoAberto = true;
    };
    ws.onmessage = (e) => {
      if (typeof e.data === "string") w.__espiao.push(e.data);
      else {
        const b = new Uint8Array(e.data as ArrayBuffer).subarray(1, 33);
        w.__espiao.push(`binario:${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`);
      }
    };
  }, anuncios);
  await expect
    .poll(() =>
      j1.pagina.evaluate(() => (window as unknown as { __espiaoAberto: boolean }).__espiaoAberto),
    )
    .toBe(true);
  await j1.pagina.waitForTimeout(500);

  // o mestre sai e volta num navegador novo (cache vazio) pedindo o arquivo: o único que diz ter é
  // o jogador
  await mestre.contexto.close();
  const mestre2 = await entrarNoMapa(mesa, "mestre");
  const resposta = await enviarCru(
    mestre2.pagina,
    intencaoCrua("asset.pedir", { hash: goblin.hash }),
  );
  expect(resposta?.tipo).not.toBe("erro"); // o mestre vê o asset: a sala aceita o pedido
  await mestre2.pagina.waitForTimeout(1500);

  // a sala nunca pediu ao jogador para enviar: nada do goblin chegou à conexão dele
  const espiao = await j1.pagina.evaluate(
    () => (window as unknown as { __espiao: string[] }).__espiao,
  );
  expect(espiao.join("\n")).not.toContain(goblin.hash);
  expect(j1.frames.join("\n")).not.toContain(goblin.hash);
});

test("a sala só repassa pedaço que ela pediu àquele socket: frame forjado some em silêncio", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  const idRei = await criarToken(mestre.pagina, "Rei");
  await abrirPainelDoToken(mestre.pagina, idRei);
  await imagemDoTokenSelecionado(mestre.pagina, arquivoPng("rei.png", pngDeRuido(200, 200, 41, 4)));
  const meta = await metaPorNome(mestre.pagina, "rei.png");
  await esperarPronto(j1.pagina, meta.hash);
  await esperarPronto(j2.pagina, meta.hash);
  const antes = [mestre.binarios.length, j1.binarios.length, j2.binarios.length];

  // o jogador 1 tenta empurrar um pedaço falso do asset para todos (e um binário qualquer)
  await j1.pagina.evaluate(async (hash) => {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    await new Promise((r) => {
      ws.onopen = r;
    });
    const frame = new Uint8Array(41 + 16);
    frame[0] = 1;
    frame.set(hash.match(/../g)?.map((h) => Number.parseInt(h, 16)) ?? [], 1);
    new DataView(frame.buffer).setUint32(33, 0);
    new DataView(frame.buffer).setUint32(37, 1);
    ws.send(frame);
    ws.send(new Uint8Array([9, 9, 9]));
    await new Promise((r) => setTimeout(r, 800));
    ws.close();
  }, meta.hash);
  await j1.pagina.waitForTimeout(500);
  expect([mestre.binarios.length, j1.binarios.length, j2.binarios.length]).toEqual(antes);
  // a sala continua de pé
  await expect(j2.pagina.getByTestId("status-conexao")).toHaveText("conectado");
});

test("reiniciar a sala: o mapa volta do SQLite e a posse é refeita pelo inventário (um jogador novo recebe de quem tinha)", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await definirMapa(
    mestre.pagina,
    "cena-1",
    arquivoPng("reinicio.png", pngDeRuido(1000, 600, 51, 2)),
  );
  const manifesto = await metaPorNome(mestre.pagina, "reinicio.png");
  await esperarPronto(j1.pagina, manifesto.hash);

  const quedas = [mestre, j1].map(
    (s) => new Promise<void>((resolver) => s.pagina.once("websocket", () => resolver())),
  );
  await request.post("/teste/reiniciar-sala").catch(() => {});
  await Promise.all(quedas);
  for (const s of [mestre, j1]) {
    await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
    // a conexão nova manda o inventário (a posse da conexão antiga morreu com ela)
    await expect
      .poll(() => s.enviados.filter((f) => f.includes('"tipo":"asset.inventario"')).length)
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(async () => (await imagensDoMapa(s.pagina)).tiles.length)
      .toBe(manifesto.tiles?.length ?? -1);
  }

  // o mestre sai; o jogador 2 entra sem cache e recebe do jogador 1 (posse refeita pelo inventário)
  await mestre.contexto.close();
  await abrirAba(j1.pagina, "chat");
  await expect(j1.pagina.getByTestId("presenca-estado-mestre")).not.toHaveText("online", {
    timeout: 20_000,
  });
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await esperarPronto(j2.pagina, manifesto.hash);
  expect((await assets(j2.pagina, "verificarCache")).every((c) => c.ok)).toBe(true);
});

test("exportar → zerar → importar: o mapa e as imagens voltam só como metadados e aparecem do cache", async ({
  mesa,
  request,
}) => {
  test.setTimeout(120_000);
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 512 });
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  await definirMapa(
    mestre.pagina,
    "cena-1",
    arquivoPng("exporta.png", pngDeRuido(1000, 600, 61, 2)),
  );
  const manifesto = await metaPorNome(mestre.pagina, "exporta.png");
  await selecionarToken(mestre.pagina, "tok-ogro");
  await imagemDoTokenSelecionado(
    mestre.pagina,
    arquivoPng("brasao.png", pngDeRuido(200, 200, 62, 4)),
  );
  const brasao = await metaPorNome(mestre.pagina, "brasao.png");
  await esperarPronto(j1.pagina, manifesto.hash);
  await esperarPronto(j1.pagina, brasao.hash);
  // o token já tem a imagem no estado da sala (a exportação sai do estado)
  await expect
    .poll(() => mestre.frames.some((f) => f.includes("token.editado") && f.includes(brasao.hash)))
    .toBe(true);

  await abrirAba(mestre.pagina, "mesa");
  const exportar = async () => {
    const [download] = await Promise.all([
      mestre.pagina.waitForEvent("download"),
      mestre.pagina.getByTestId("exportar").click(),
    ]);
    const caminho = await download.path();
    return { caminho, texto: readFileSync(caminho, "utf8") };
  };
  const antes = await exportar();
  const json = JSON.parse(antes.texto);
  expect(json.versao).toBe(13);
  // só metadados: o manifesto, os tiles (2 x 2) e a imagem do token; nenhum byte de imagem
  expect(json.dados.assets).toHaveLength((manifesto.tiles?.length ?? 0) + 2);
  expect(json.dados.cenas[0].mapa).toEqual({ assetHash: manifesto.hash, pxPorQuadrado: 70 });
  expect(json.dados.tokens.find((t: { id: string }) => t.id === "tok-ogro").assetHash).toBe(
    brasao.hash,
  );
  expect(antes.texto.length).toBeLessThan(40_000);

  await request.post("/teste/zerar");
  await expect.poll(async () => (await imagensDoMapa(j1.pagina)).tiles.length).toBe(0);
  const binariosAntes = j1.binarios.length;

  await mestre.pagina.getByTestId("importar-arquivo").setInputFiles(antes.caminho);
  // o jogador reconhece os mesmos hashes no próprio cache: o mapa volta sem nenhum pedaço novo
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tiles.length)
    .toBe(manifesto.tiles?.length ?? -1);
  await expect
    .poll(async () => (await imagensDoMapa(j1.pagina)).tokensComImagem)
    .toContain("tok-ogro");
  await j1.pagina.waitForTimeout(1000);
  expect(j1.binarios.length).toBe(binariosAntes);
  const depois = await exportar();
  expect(JSON.parse(depois.texto).dados).toEqual(json.dados);
});
