import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import type { APIRequestContext, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";
import { arquivoPng, assets, definirMapa } from "../tests/ajudasAssets";
import { definirValor, ligarOrdem, linha, menuDoToken, vezNaOrdem } from "../tests/ajudasCombate";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa } from "../tests/ajudasMapa";

// Prints do lote R2 do redesign (estrutura fixa): a mesma campanha de demonstração da auditoria
// (montagem copiada de auditoria.spec.ts), fotografada nos 3 temas e em 1600×900 e 1280×720. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);

const test = base.extend<{ grande: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
});

// ---------------------------------------------------------------------------------------------
// Fotos e o relatório do que não deu certo
// ---------------------------------------------------------------------------------------------

const tiradas: string[] = [];
const falhas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

/** Roda um passo; se falhar, registra e segue (um print que falha não derruba os outros). */
async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo();
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ");
    falhas.push(`${nome}: ${msg}`);
    console.log(`[FALHOU] ${nome}: ${msg}`);
  }
}

test.afterAll(() => {
  console.log(`[R2] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R2] FALHAS:\n - ${falhas.join("\n - ")}`);
});

// ---------------------------------------------------------------------------------------------
// O mapa da campanha de demonstração (PNG gerado aqui: nada de arquivo no repositório)
// ---------------------------------------------------------------------------------------------

const PX_M = 40;

/** Ruído barato e determinístico por bloco. */
function ruido(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 255) / 255;
}

type Ret = { x0: number; y0: number; x1: number; y1: number };
const emM = (x0: number, y0: number, x1: number, y1: number): Ret => ({
  x0: x0 * PX_M,
  y0: y0 * PX_M,
  x1: x1 * PX_M,
  y1: y1 * PX_M,
});

/** Uma masmorra simples: rocha escura, um salão de lajotas, um corredor e a sala de tábuas da semente. */
function pngDaMasmorra(largura: number, altura: number): Buffer {
  const salao = emM(3, 3, 38, 20);
  const corredor = emM(10.5, 20, 12, 24);
  const sala = emM(4.5, 24, 18, 36);
  const caverna = emM(26, 24, 52, 40);
  const dentro = (r: Ret, x: number, y: number) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  const tam = largura * 3 + 1;
  const bruto = Buffer.alloc(tam * altura);
  for (let y = 0; y < altura; y++) {
    bruto[y * tam] = 0;
    for (let x = 0; x < largura; x++) {
      let r = 38;
      let g = 34;
      let b = 32;
      let v = ruido(x >> 3, y >> 3) * 14;
      if (dentro(salao, x, y) || dentro(corredor, x, y)) {
        // lajotas de 60 px com junta escura
        const junta = x % 60 < 2 || y % 60 < 2;
        const laje = ruido(Math.floor(x / 60), Math.floor(y / 60)) * 26;
        r = junta ? 52 : 112 + laje;
        g = junta ? 48 : 106 + laje;
        b = junta ? 44 : 96 + laje;
        v = junta ? 0 : ruido(x >> 2, y >> 2) * 10;
      } else if (dentro(sala, x, y)) {
        // tábuas horizontais
        const junta = y % 30 < 2;
        const t = ruido(Math.floor(x / 160), Math.floor(y / 30)) * 30;
        r = junta ? 50 : 104 + t;
        g = junta ? 36 : 76 + t * 0.7;
        b = junta ? 24 : 48 + t * 0.4;
        v = junta ? 0 : ruido(x >> 1, y >> 3) * 8;
      } else if (dentro(caverna, x, y)) {
        r = 76;
        g = 92;
        b = 70;
        v = ruido(x >> 4, y >> 4) * 30;
      }
      const o = y * tam + 1 + x * 3;
      bruto[o] = Math.min(255, Math.round(r + v));
      bruto[o + 1] = Math.min(255, Math.round(g + v));
      bruto[o + 2] = Math.min(255, Math.round(b + v));
    }
  }
  const bloco = (tipo: string, dados: Buffer) => {
    const saida = Buffer.alloc(12 + dados.length);
    saida.writeUInt32BE(dados.length, 0);
    saida.write(tipo, 4, "ascii");
    dados.copy(saida, 8);
    saida.writeUInt32BE(crc32(saida.subarray(4, 8 + dados.length)), 8 + dados.length);
    return saida;
  };
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(largura, 0);
  cab.writeUInt32BE(altura, 4);
  cab.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", cab),
    bloco("IDAT", deflateSync(bruto)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------------------------
// Ajudantes de tela
// ---------------------------------------------------------------------------------------------

const alcas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.alcas());

async function enquadrar(p: Page, x: number, y: number, zoom = 1, desvioPx = 0) {
  await p.evaluate(
    ([zx, zy, zz, zd]) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      h.definirZoom(zz as number);
      h.centrarEm((zx as number) + (zd as number) / (40 * (zz as number)), zy as number);
    },
    [x, y, zoom, desvioPx],
  );
  await p.waitForTimeout(700);
}

async function levar(p: Page, id: string, x: number, y: number) {
  await mandar(p, "token.soltar", { id, x, y });
}

async function dizer(p: Page, texto: string, como?: string) {
  if (como) await p.getByTestId("chat-como").selectOption({ label: como });
  const antes = await p.getByTestId("chat-mensagem").count();
  await p.getByTestId("chat-texto").fill(texto);
  await p.getByTestId("chat-texto").press("Enter");
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(antes + 1);
}

// ---------------------------------------------------------------------------------------------
// A campanha de demonstração
// ---------------------------------------------------------------------------------------------

const FICHAS: Record<string, Record<string, unknown>> = {
  "pers-aldric": {
    raca: "Humano",
    antecedente: "Soldado",
    alinhamento: "Leal e Bom",
    classes: [{ classe: "Guerreiro", subclasse: "Campeão", nivel: 3 }],
    atributos: { for: 16, des: 13, con: 15, int: 10, sab: 12, car: 10 },
    salvaguardas: { for: { nivel: "proficiente" }, con: { nivel: "proficiente" } },
    pericias: { atletismo: { nivel: "proficiente" }, percepcao: { nivel: "proficiente" } },
    ca: { valor: 18 },
    deslocamentoFt: 30,
    pvAtual: 22,
    pvMax: 28,
    ataques: [
      { nome: "Espada longa", acerto: { tipo: "fixo", valor: 5 }, dano: "1d8+3" },
      { nome: "Besta leve", acerto: { tipo: "fixo", valor: 3 }, dano: "1d8+1" },
    ],
    caracteristicas: [
      { nome: "Retomar o Fôlego", descricao: "Recupera 1d10+3 PV uma vez por descanso." },
    ],
    itens: [
      { nome: "Cota de malha", quantidade: 1 },
      { nome: "Corda de cânhamo (15 m)", quantidade: 1 },
    ],
  },
  "pers-brisa": {
    raca: "Elfo",
    antecedente: "Sábia",
    alinhamento: "Neutro e Bom",
    classes: [{ classe: "Mago", subclasse: "Evocação", nivel: 3 }],
    atributos: { for: 8, des: 14, con: 13, int: 17, sab: 12, car: 10 },
    ca: { valor: 12 },
    deslocamentoFt: 30,
    pvAtual: 9,
    pvMax: 17,
    ataques: [{ nome: "Adaga", acerto: { tipo: "fixo", valor: 4 }, dano: "1d4+2" }],
    magias: [
      { nome: "Raio de Fogo", nivel: 0, preparada: true, descricao: "" },
      { nome: "Mísseis Mágicos", nivel: 1, preparada: true, descricao: "" },
      { nome: "Escudo Arcano", nivel: 1, preparada: true, descricao: "" },
      { nome: "Bola de Fogo", nivel: 3, preparada: false, descricao: "" },
    ],
  },
  "pers-cael": {
    raca: "Halfling",
    antecedente: "Criminoso",
    alinhamento: "Caótico e Neutro",
    classes: [{ classe: "Ladino", subclasse: "Ladrão", nivel: 3 }],
    atributos: { for: 9, des: 17, con: 13, int: 12, sab: 11, car: 14 },
    pericias: { furtividade: { nivel: "especialista" }, prestidigitacao: { nivel: "proficiente" } },
    ca: { valor: 14 },
    deslocamentoFt: 25,
    pvAtual: 20,
    pvMax: 20,
    ataques: [{ nome: "Rapieira", acerto: { tipo: "fixo", valor: 5 }, dano: "1d8+3" }],
  },
  "pers-ogro": {
    raca: "Ogro",
    ca: { valor: 11 },
    deslocamentoFt: 40,
    pvAtual: 59,
    pvMax: 59,
    atributos: { for: 19, des: 8, con: 16, int: 5, sab: 7, car: 7 },
    ataques: [{ nome: "Clava grande", acerto: { tipo: "fixo", valor: 6 }, dano: "2d8+4" }],
  },
};

const NPCS = [
  { id: "tok-gob-arqueiro", nome: "Goblin Arqueiro", x: 24, y: 11.25, cor: "#7f8c3a" },
  { id: "tok-gob-capanga", nome: "Goblin Capanga", x: 27, y: 14.25, cor: "#9a7d2e" },
];

type Campanha = {
  mestre: Page;
  j1: Page;
  j2: Page;
  mestreSessao: Awaited<ReturnType<typeof entrarNoMapa>>;
};

/**
 * Monta tudo e deixa as telas "em jogo": mestre, Aldric (jogador-1) e Brisa (jogador-2). A lateral
 * fica aberta no chat e o painel da ordem de turno fica ligado.
 */
async function montar(mesa: Mesa, request: APIRequestContext): Promise<Campanha> {
  expect((await request.post("/teste/dados?semente=5")).ok()).toBe(true);
  const ms = await entrarNoMapa(mesa, "mestre");
  const m = ms.pagina;
  const s1 = await entrarNoMapa(mesa, "jogador-1");
  const s2 = await entrarNoMapa(mesa, "jogador-2");
  const j1 = s1.pagina;
  const j2 = s2.pagina;

  // o compêndio de exemplo na pasta do mestre
  await assets(m, "adicionarNaPasta", "compendio/magias.json", SRD);

  // o mapa (pelo caminho do usuário: Cenas → Configurar → imagem → Salvar)
  await definirMapa(m, "cena-1", arquivoPng("masmorra.png", pngDaMasmorra(2400, 1800)), 60);
  await m.getByTestId("menu-cenas").click();
  await expect(m.getByTestId("faixa-cenas")).toHaveCount(0);

  // fichas dos três PJs e do Ogro; o Darion importado da fixture e posto no mapa
  for (const [id, ficha] of Object.entries(FICHAS)) {
    await mandar(m, "ficha.alterar", {
      personagemId: id,
      operacoes: [{ caminho: "", valor: ficha }],
    });
  }
  await criarDarion(m);
  await mandar(m, "personagem.colocar", {
    personagemId: DARION_ID,
    cenaId: "cena-1",
    tokenId: "tok-darion",
    x: 9.75,
    y: 12.75,
  });

  // NPCs: dois goblins visíveis (o Ogro e o goblin oculto já vêm na semente)
  for (const n of NPCS) {
    await mandar(m, "token.criar", {
      token: {
        id: n.id,
        nome: n.nome,
        cor: n.cor,
        tamanhoQuadrados: 1,
        x: n.x,
        y: n.y,
        camada: "tokens",
        oculto: false,
        controladoPor: [],
      },
    });
  }

  // o grupo junto, em volta de onde a tocha vai ficar
  await levar(m, "tok-jogador-1", 11.25, 9.75);
  await levar(m, "tok-jogador-2", 14.25, 11.25);
  await levar(m, "tok-jogador-3", 12.75, 12.75);

  // tocha acesa na mão do Aldric (a cena já é escura: luz ambiente baixa)
  await mandar(m, "mochila.ajustar", {
    personagemId: "pers-aldric",
    modeloId: "modelo-tocha",
    delta: 3,
  });
  await mandar(j1, "tocha.acender", {
    personagemId: "pers-aldric",
    modeloId: "modelo-tocha",
    novoId: "tocha-1",
  });
  await expect.poll(async () => (await alcas(j1)).length).toBe(1);

  // desenhos do pincel (o autor é quem manda)
  const onda = Array.from({ length: 30 }, (_, i) => ({
    x: 4 + (10 * i) / 29,
    y: 5.5 + Math.sin(i / 3) * 1.1,
  }));
  await mandar(j1, "desenho.criar", {
    desenho: { id: "d-livre", forma: "livre", pontos: onda, cor: "#e6194b", espessura: 6 },
  });
  await mandar(m, "desenho.criar", {
    desenho: {
      id: "d-linha",
      forma: "linha",
      pontos: [
        { x: 12.5, y: 9.75 },
        { x: 22, y: 11.25 },
      ],
      cor: "#e0a030",
      espessura: 4,
    },
  });
  await mandar(m, "desenho.criar", {
    desenho: {
      id: "d-circ",
      forma: "circulo",
      pontos: [
        { x: 30, y: 15 },
        { x: 32.5, y: 15 },
      ],
      cor: "#3cb44b",
      espessura: 5,
    },
  });

  // condições na Brisa, pelo menu do token (botão direito)
  await enquadrar(m, 14.25, 11.25, 1.6, 215);
  await menuDoToken(m, "tok-jogador-2", 38);
  await m.getByTestId("menu-token-condicoes").click();
  await m.getByTestId("condicao-amedrontado").click();
  await m.getByTestId("condicao-envenenado").click();
  await m.getByTestId("exaustao-1").click();
  await m.getByTestId("menu-token-fechar").click();

  // combate: iniciativas, e a vez do Aldric na rodada 2
  await mandar(m, "combate.adicionar", {
    entradas: [
      { id: "e-aldric", tokenId: "tok-jogador-1" },
      { id: "e-brisa", tokenId: "tok-jogador-2" },
      { id: "e-cael", tokenId: "tok-jogador-3" },
      { id: "e-darion", tokenId: "tok-darion" },
      { id: "e-ogro", tokenId: "tok-ogro" },
      { id: "e-arqueiro", tokenId: "tok-gob-arqueiro" },
      { id: "e-capanga", tokenId: "tok-gob-capanga" },
    ],
  });
  await ligarOrdem(m);
  await m.getByTestId("ordem-rolar-todos").click();
  const valores: [string, number][] = [
    ["Aldric", 18],
    ["Ogro", 16],
    ["Brisa", 14],
    ["Goblin Arqueiro", 13],
    ["Cael", 11],
    ["Darion", 10],
    ["Goblin Capanga", 6],
  ];
  // a lista se reordena a cada valor digitado: confere o que ficou e refaz o que saiu errado
  for (let volta = 0; volta < 4; volta++) {
    let tudoCerto = true;
    for (const [nome, v] of valores) {
      const campo = linha(m, nome).locator('input[type="number"]');
      if ((await campo.inputValue()) !== String(v)) {
        await definirValor(m, nome, v);
        await m.waitForTimeout(250);
        tudoCerto = false;
      }
    }
    if (tudoCerto) break;
  }
  // avança um turno de cada vez, esperando a vez mudar (clicar depressa demais perde cliques)
  for (let i = 0; i < 12; i++) {
    const rodada = await m.getByTestId("ordem-rodada").textContent();
    if (rodada === "Rodada 2" && (await vezNaOrdem(m)) === "Aldric") break;
    const antes = `${rodada}|${await vezNaOrdem(m)}`;
    await m.getByTestId("ordem-proximo").click();
    await expect
      .poll(
        async () => `${await m.getByTestId("ordem-rodada").textContent()}|${await vezNaOrdem(m)}`,
      )
      .not.toBe(antes);
  }
  await expect.poll(() => vezNaOrdem(m)).toBe("Aldric");
  await expect(m.getByTestId("ordem-rodada")).toHaveText("Rodada 2");

  // chat: texto, rolagens, sussurro, magia
  await abrirAba(m, "chat");
  await abrirAba(j1, "chat");
  await abrirAba(j2, "chat");
  await dizer(
    m,
    "Uma luz fraca vem do salão: goblins e um ogro armam uma emboscada.",
    "Mestre (eu mesmo)",
  );
  await dizer(m, "/em rosna e ergue a clava", "Ogro");
  await dizer(j1, "Eu ergo a tocha e avanço: [[1d20+5]] de Percepção.", "Aldric");
  await dizer(j2, "/em prepara o arco", "Brisa");
  await dizer(j1, "/r 1d20+5 Ataque com a espada longa", "Aldric");
  await dizer(j2, "/w Jogador 1 Cuidado com o goblin da esquerda.", "Brisa");
  const missil = (JSON.parse(SRD).magias as { nome: string }[]).find(
    (x) => x.nome === "Mísseis Mágicos",
  );
  await mandar(j2, "chat.magia", { magia: missil, como: "pers-brisa" });
  await dizer(m, "Roll for initiative! Aldric, é a sua vez.", "Mestre (eu mesmo)");

  // deixa a vista do mestre e dos jogadores no quadro "em jogo"
  for (const p of [m, j1, j2]) await enquadrar(p, 19, 12, 0.95);
  return { mestre: m, j1, j2, mestreSessao: ms };
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// Os 3 temas, nos dois tamanhos
// ---------------------------------------------------------------------------------------------

const TEMAS = ["grimorio", "escuro", "claro"] as const;
const TAMANHOS = [
  { nome: "1600", width: 1600, height: 900 },
  { nome: "1280", width: 1280, height: 720 },
] as const;

/** Troca o tema pelo seletor da aba Configurações (deixa o painel nessa aba). */
async function trocarTema(p: Page, id: string) {
  await abrirAba(p, "configuracoes");
  await p.getByTestId(`tema-${id}`).click();
  await expect(p.locator("html")).toHaveAttribute("data-tema", id);
  await p.waitForTimeout(200);
}

async function larguraDoPainel(p: Page) {
  return Math.round((await p.getByTestId("barra-lateral").boundingBox())?.width ?? 0);
}

/** Leva a alça do painel até `alvo` px (clampado pelo mínimo e pelo máximo). */
async function painelEm(p: Page, alvo: number) {
  const janela = p.viewportSize() as { width: number };
  const a = await p.getByTestId("alca-do-painel").boundingBox();
  if (!a) return;
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(janela.width - alvo, a.y + a.height / 2, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(300);
}

test("r2: a estrutura fixa nos 3 temas e nos 2 tamanhos", async ({ grande, request }) => {
  test.setTimeout(1_200_000);
  const { mestre: m, j1, j2 } = await montar(grande, request);

  for (const t of TEMAS) {
    await trocarTema(m, t);
    await trocarTema(j1, t);
    await trocarTema(j2, t);

    for (const z of TAMANHOS) {
      const base = `${t}-${z.nome}`;
      for (const p of [m, j1, j2]) {
        await p.setViewportSize({ width: z.width, height: z.height });
      }
      await painelEm(m, 360);
      await painelEm(j1, 360);
      for (const p of [m, j1, j2]) {
        await abrirAba(p, "chat");
        await enquadrar(p, 19, 12, z.width === 1600 ? 0.95 : 0.8);
      }

      await tentar(`${base} mesas`, async () => {
        await foto(m, `${base}-01-mesa-mestre`, 700);
        await foto(j1, `${base}-02-mesa-jogador`, 700);
      });

      await tentar(`${base} painel mínimo e máximo`, async () => {
        await painelEm(m, 1);
        await foto(m, `${base}-03-painel-minimo-${await larguraDoPainel(m)}px`);
        await painelEm(m, 2000);
        await foto(m, `${base}-04-painel-maximo-${await larguraDoPainel(m)}px`);
        await abrirAba(m, "configuracoes");
        await foto(m, `${base}-04b-painel-maximo-configuracoes`);
        await painelEm(m, 360);
        await abrirAba(m, "chat");
      });

      await tentar(`${base} painel recolhido`, async () => {
        await m.getByTestId("lateral-recolher").click();
        await m.waitForTimeout(300);
        await foto(m, `${base}-05-painel-recolhido`);
        await m.getByTestId("aba-chat").click();
        await expect(m.getByTestId("alca-do-painel")).toBeVisible();
      });

      await tentar(`${base} pausada`, async () => {
        await m.getByTestId("menu-pausa").click();
        await expect(j1.getByTestId("estado-mesa-selo")).toBeVisible();
        await foto(j1, `${base}-06-pausada-jogador`, 700);
        await foto(m, `${base}-06b-pausada-mestre`);
        await m.getByTestId("menu-pausa").click();
        await expect(j1.getByTestId("estado-mesa-selo")).toHaveCount(0);
      });

      await tentar(`${base} ordem de turno`, async () => {
        await expect(m.getByTestId("ordem-de-turno")).toBeVisible();
        await foto(m, `${base}-07-ordem-de-turno`);
        // com o painel do token aberto também
        await selecionarTokenSeguro(m, "tok-jogador-1");
        await foto(m, `${base}-07b-ordem-e-painel-do-token`);
        await m.keyboard.press("Escape");
      });

      await tentar(`${base} ficha`, async () => {
        await abrirFicha(m, DARION_ID, "principal");
        await foto(m, `${base}-08-ficha-aberta`);
        await m.getByTestId("janela-ficha-fechar").click();
        await abrirAba(m, "chat");
      });

      await tentar(`${base} faixa de cenas`, async () => {
        await m.getByTestId("menu-cenas").click();
        await expect(m.getByTestId("faixa-cenas")).toBeVisible();
        await foto(m, `${base}-09-faixa-de-cenas`);
        await m.getByTestId("menu-cenas").click();
      });

      await tentar(`${base} pincel e dados`, async () => {
        await m.getByTestId("ferramenta-pincel").click();
        await expect(m.getByTestId("sub-barra-pincel")).toBeVisible();
        await foto(m, `${base}-10-sub-barra-do-pincel`);
        await m.getByTestId("pincel-fechar").click();
        await m.getByTestId("ferramenta-dados").click();
        await foto(m, `${base}-11-dados-rapidos`);
        await m.getByTestId("ferramenta-dados").click();
      });

      await tentar(`${base} presença com +N`, async () => {
        await m.getByTestId("presenca-mais").click();
        await foto(m, `${base}-12-presenca-lista`);
        await m.keyboard.press("Escape");
      });
    }
  }
});

/** Seleciona o token com um clique de verdade (o painel do token abre). */
async function selecionarTokenSeguro(p: Page, id: string) {
  await expect(async () => {
    const t = (await p.evaluate((tid) => {
      const h = (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop;
      const k = h.tokens().find((x) => x.id === tid);
      return k ? h.paraTela(k.x, k.y) : null;
    }, id)) as { x: number; y: number } | null;
    if (!t) throw new Error("token fora do mapa");
    await p.mouse.click(t.x, t.y);
    await expect(p.getByTestId("painel-token")).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
}
