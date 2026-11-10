import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import {
  abrirAba,
  test as base,
  enviarCru,
  expect,
  intencaoCrua,
  Mesa,
  menuDaCena,
} from "../tests/ajudas";
import { arquivoPng, assets, definirMapa } from "../tests/ajudasAssets";
import { definirValor, ligarOrdem, linha, menuDoToken, vezNaOrdem } from "../tests/ajudasCombate";
import { abrirPincel, escolherNoPincel } from "../tests/ajudasDesenho";
import { type AbaDaFicha, abrirFicha, criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa, pontoNaPagina } from "../tests/ajudasMapa";

// Auditoria de usabilidade: um conjunto completo de prints da interface atual (mestre e jogador), antes
// do redesign. Só CAPTURA: não corrige nem opina. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints auditoria
// Os testes montam a mesma campanha de demonstração (mapa, 3 PJs, o Darion, NPCs, tocha, combate na
// rodada 2, desenhos, chat, compêndio) e tiram os prints; o que falhar vai para a lista final, sem
// derrubar o resto.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const SRD = readFileSync(
  new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const PDF = fileURLToPath(new URL("../../fixtures/fichas/darion.pdf", import.meta.url));

const test = base.extend<{ grande: Mesa; pequena: Mesa }>({
  grande: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    await use(mesa);
    await mesa.fechar();
  },
  pequena: async ({ browser, zerado: _ }, use) => {
    const mesa = new Mesa(browser, { viewport: { width: 1280, height: 720 } });
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

/** Um recorte da página (px), para ver de perto um popover ou uma barra. */
async function recorte(
  p: Page,
  nome: string,
  area: { x: number; y: number; width: number; height: number },
) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`), clip: area });
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
  console.log(`[AUDITORIA] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[AUDITORIA] FALHAS:\n - ${falhas.join("\n - ")}`);
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

type Alca = ReturnType<GanchoDoMapa["alcas"]>[number];
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

async function recolherLateral(p: Page) {
  if ((await p.getByTestId("barra-lateral").getAttribute("data-aberta")) === "true") {
    await p.getByTestId("lateral-recolher").click();
  }
  await expect(p.getByTestId("barra-lateral")).toHaveAttribute("data-aberta", "false");
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

/** Fecha o que estiver aberto em cima do mapa (popovers, faixa de cenas). */
async function limparTela(p: Page) {
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
}

async function cliqueNaPorta(p: Page, portaId: string) {
  const porta = (
    await p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.portas())
  ).find((q) => q.id === portaId);
  if (!porta) throw new Error(`porta ${portaId} não aparece`);
  await enquadrar(p, porta.meio.x, porta.meio.y, 1);
  const alvo = await pontoNaPagina(p, porta.meio.x, porta.meio.y);
  await p.mouse.click(alvo.x, alvo.y);
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
// 1. Entrada, mesa ao entrar, estados vazios, aviso
// ---------------------------------------------------------------------------------------------

test("auditoria 00-09: entrada, mesa ao entrar, estados vazios e aviso (mesa recém-criada)", async ({
  grande,
}) => {
  test.setTimeout(240_000);
  const pg = await grande.abrir();
  await pg.pagina.goto("/");
  await expect(pg.pagina.getByTestId("lista-usuarios")).toBeVisible();
  await foto(pg.pagina, "00-entrada-escolher-usuario");

  const mestre = await entrarNoMapa(grande, "mestre");
  const j1 = await entrarNoMapa(grande, "jogador-1");
  await foto(mestre.pagina, "01-mesa-ao-entrar-mestre");
  await foto(j1.pagina, "01-mesa-ao-entrar-jogador");

  // compêndio sem arquivo
  await tentar("02 compendio vazio", async () => {
    await abrirAba(mestre.pagina, "compendio");
    await abrirAba(j1.pagina, "compendio");
    await foto(mestre.pagina, "02-compendio-sem-arquivo-mestre");
    await foto(j1.pagina, "02-compendio-sem-arquivo-jogador");
  });

  // fichas vazias: um jogador sem nenhum personagem
  await tentar("03 fichas vazias", async () => {
    const j5 = await entrarNoMapa(grande, "jogador-5");
    await abrirAba(j5.pagina, "fichas");
    await foto(j5.pagina, "03-fichas-vazio-jogador-sem-personagem");
    await abrirAba(j5.pagina, "chat");
    await foto(j5.pagina, "03-chat-vazio-jogador");
  });

  // ordem de turno sem combate
  await tentar("04 ordem vazia", async () => {
    await ligarOrdem(mestre.pagina);
    await foto(mestre.pagina, "04-ordem-de-turno-vazia-mestre");
    await mestre.pagina.getByTestId("menu-ordem-turno").click();
  });

  // aviso (toast): o jogador tenta abrir uma porta que está longe
  await tentar("05 aviso", async () => {
    await cliqueNaPorta(j1.pagina, "par-sala-porta");
    await expect(j1.pagina.getByTestId("aviso")).toBeVisible();
    await foto(j1.pagina, "05-aviso-toast-porta-fora-de-alcance-jogador", 100);
  });

  // "sem cena" não existe (a sala recusa apagar a cena do grupo): o mais perto é uma cena nova, vazia
  await tentar("06 cena vazia", async () => {
    await mandar(mestre.pagina, "cena.criar", { id: "cena-vazia", nome: "Cena vazia" });
    await menuDaCena(mestre.pagina, "cena-vazia", "ir");
    await foto(mestre.pagina, "06-cena-nova-vazia-sem-mapa-nem-tokens-mestre", 1000);
    await mestre.pagina.getByTestId("menu-cenas").click();
    await foto(mestre.pagina, "06-faixa-de-cenas-com-cena-nova-mestre", 500);
  });
});

// ---------------------------------------------------------------------------------------------
// 2. A mesa em jogo, o menu superior e a barra de ferramentas
// ---------------------------------------------------------------------------------------------

test("auditoria 10-29: mesa em jogo, menu superior e barra de ferramentas", async ({
  grande,
  request,
}) => {
  test.setTimeout(420_000);
  const { mestre: m, j1, j2 } = await montar(grande, request);

  await foto(m, "10-mesa-em-jogo-mestre");
  await foto(j1, "10-mesa-em-jogo-jogador-aldric");
  await foto(j2, "10-mesa-em-jogo-jogador-brisa");

  // ---- menu superior (mestre) ----
  await tentar("11 menu cenas", async () => {
    await m.getByTestId("menu-cenas").click();
    await expect(m.getByTestId("faixa-cenas")).toBeVisible();
    await foto(m, "11-menu-cenas-faixa-aberta-mestre");
    await m.getByTestId("menu-cenas").click();
  });
  await tentar("12 camadas", async () => {
    await m.getByTestId("menu-camadas").click();
    await expect(m.getByTestId("popover-camadas")).toBeVisible();
    await foto(m, "12-menu-camadas-popover-mestre");
    await limparTela(m);
  });
  await tentar("13 visao noturna", async () => {
    await m.getByTestId("menu-visao-noturna").click({ button: "right" });
    await expect(m.getByTestId("ver-como")).toBeVisible();
    await foto(m, "13-menu-visao-noturna-ver-como-clique-direito-mestre");
    await m.getByTestId("ver-como-jogador-2").click();
    await expect(m.getByTestId("ver-como-selo")).toBeVisible();
    await foto(m, "13-ver-como-jogador-2-mestre");
    await m.getByTestId("ver-como-voltar").click();
    await m.getByTestId("menu-visao-noturna").click();
    await foto(m, "13-visao-noturna-ligada-mestre");
    await m.getByTestId("menu-visao-noturna").click();
  });
  await tentar("14 novo token", async () => {
    await m.getByTestId("novo-token").click();
    await expect(m.getByTestId("painel-token")).toBeVisible();
    await foto(m, "14-menu-novo-token-apos-clicar-mestre");
    await m.getByTestId("token-apagar").click(); // limpa o token de teste para os próximos prints
    await expect(m.getByTestId("painel-token")).toHaveCount(0);
  });
  await tentar("15 eventos", async () => {
    await m.getByTestId("menu-eventos").click();
    await expect(m.getByTestId("painel-eventos")).toBeVisible();
    await foto(m, "15-menu-eventos-automacoes-em-breve-mestre");
    await limparTela(m);
  });
  await tentar("16 iluminacao", async () => {
    await m.getByTestId("menu-iluminacao").click();
    await expect(m.getByTestId("lanterna")).toBeVisible();
    await foto(m, "16-menu-iluminacao-lista-mestre");
    await limparTela(m);
  });
  await tentar("17 ordem de turno", async () => {
    await foto(m, "17-ordem-de-turno-mestre-rodada-2");
    await foto(j1, "17-ordem-de-turno-jogador-aldric-na-vez");
    await foto(j2, "17-ordem-de-turno-jogador-brisa-fora-da-vez");
    await recorte(m, "17-ordem-de-turno-mestre-recorte", { x: 0, y: 0, width: 520, height: 900 });
  });
  await tentar("18 pausa", async () => {
    await m.getByTestId("menu-pausa").click();
    await expect(j1.getByTestId("selo-pausa")).toBeVisible();
    await foto(m, "18-pausa-mesa-pausada-mestre");
    await foto(j1, "18-pausa-mesa-pausada-jogador");
    await recorte(m, "18-pausa-relogio-recorte", { x: 450, y: 0, width: 700, height: 80 });
    await m.getByTestId("menu-pausa").click();
  });

  // ---- barra de ferramentas (esquerda): o painel da ordem sai do caminho no mestre ----
  await m.getByTestId("menu-ordem-turno").click();
  await tentar("20 barra visao geral", async () => {
    await recorte(m, "20-barra-de-ferramentas-recorte-mestre", {
      x: 0,
      y: 60,
      width: 120,
      height: 480,
    });
  });
  await tentar("21 selecionar com token e painel", async () => {
    await m.getByTestId("ferramenta-selecionar").click();
    const alvo = await pontoNaPagina(m, 14.25, 11.25);
    await m.mouse.click(alvo.x, alvo.y);
    await expect(m.getByTestId("painel-token")).toBeVisible();
    await foto(m, "21-ferramenta-selecionar-token-e-painel-do-token-mestre");
    await m.mouse.click(900, 760); // clique no vazio solta a seleção
    // o jogador seleciona o próprio token
    const aldric = await pontoNaPagina(j1, 11.25, 9.75);
    await j1.mouse.click(aldric.x, aldric.y);
    await foto(j1, "21-ferramenta-selecionar-token-proprio-jogador");
    await j1.mouse.click(aldric.x + 300, aldric.y + 300);
  });
  await tentar("22 mao", async () => {
    await m.getByTestId("ferramenta-mao").click();
    await foto(m, "22-ferramenta-mao-mestre");
    await j1.getByTestId("ferramenta-mao").click();
    await foto(j1, "22-ferramenta-mao-jogador");
    await m.getByTestId("ferramenta-selecionar").click();
    await j1.getByTestId("ferramenta-selecionar").click();
  });
  await tentar("23 regua", async () => {
    for (const [p, quem] of [
      [m, "mestre"],
      [j1, "jogador"],
    ] as const) {
      await p.getByTestId("ferramenta-regua").click();
      const a = await pontoNaPagina(p, 11.25, 9.75);
      const b = await pontoNaPagina(p, 24, 11.25);
      await p.mouse.move(a.x, a.y);
      await p.mouse.down();
      await p.mouse.move(b.x, b.y, { steps: 14 });
      await foto(p, `23-ferramenta-regua-medindo-${quem}`);
      await p.mouse.up();
      await p.getByTestId("ferramenta-selecionar").click();
    }
  });
  await tentar("24 dados rapidos", async () => {
    await m.getByTestId("ferramenta-dados").click();
    await expect(m.getByTestId("dados-rapidos")).toBeVisible();
    await foto(m, "24-ferramenta-dados-rapidos-aberto-mestre");
    await m.getByTestId("ferramenta-dados").click();
    await j1.getByTestId("ferramenta-dados").click();
    await foto(j1, "24-ferramenta-dados-rapidos-aberto-jogador");
    await j1.getByTestId("ferramenta-dados").click();
  });
  await tentar("25 pincel", async () => {
    await abrirPincel(m);
    await escolherNoPincel(m, "retangulo");
    await foto(m, "25-ferramenta-pincel-subbarra-mestre");
    await recorte(m, "25-ferramenta-pincel-subbarra-recorte", {
      x: 0,
      y: 120,
      width: 440,
      height: 640,
    });
    await m.getByTestId("pincel-fechar").click();
    await abrirPincel(j1);
    await foto(j1, "25-ferramenta-pincel-subbarra-jogador");
    await j1.getByTestId("pincel-fechar").click();
  });
});

// ---------------------------------------------------------------------------------------------
// 3. Painel lateral e menus de contexto
// ---------------------------------------------------------------------------------------------

test("auditoria 30-39: painel lateral (cada aba, mestre e jogador), recolhido e menus de contexto", async ({
  grande,
  request,
}) => {
  test.setTimeout(420_000);
  const { mestre: m, j1, j2 } = await montar(grande, request);
  await m.getByTestId("menu-ordem-turno").click(); // o painel da ordem cobriria o mapa do mestre

  for (const [p, quem] of [
    [m, "mestre"],
    [j1, "jogador"],
  ] as const) {
    for (const aba of ["chat", "fichas", "compendio", "configuracoes", "mestre"]) {
      await tentar(`30 aba ${aba} ${quem}`, async () => {
        if ((await p.getByTestId(`aba-${aba}`).count()) === 0) {
          falhas.push(`(esperado) aba "${aba}" não existe para ${quem}`);
          return;
        }
        await abrirAba(p, aba);
        await foto(p, `30-lateral-aba-${aba}-${quem}`);
      });
    }
  }
  await tentar("30 compendio com cartao", async () => {
    await abrirAba(m, "compendio");
    await m.getByTestId("compendio-busca").fill("bola");
    await m.getByTestId("compendio-item").first().click();
    await expect(m.getByTestId("compendio-cartao")).toBeVisible();
    await foto(m, "30-lateral-aba-compendio-cartao-aberto-mestre");
  });
  await tentar("30 fichas menu item e novo", async () => {
    await abrirAba(m, "fichas");
    await m.getByTestId("ficha-novo").click();
    await expect(m.getByTestId("ficha-novo-menu")).toBeVisible();
    await foto(m, "30-lateral-fichas-menu-novo-mestre");
    await limparTela(m);
    await m.getByTestId("ficha-novo").click();
    await m.getByTestId(`ficha-menu-${DARION_ID}`).click();
    await foto(m, "30-lateral-fichas-menu-do-item-mestre");
    await limparTela(m);
  });
  await tentar("31 lateral recolhida", async () => {
    await abrirAba(m, "chat");
    await recolherLateral(m);
    await foto(m, "31-lateral-recolhida-mestre");
    await recolherLateral(j1);
    await foto(j1, "31-lateral-recolhida-jogador");
    await m.getByTestId("lateral-recolher").click();
    await j1.getByTestId("lateral-recolher").click();
  });

  // ---- menus de contexto ----
  await tentar("32 menu do token", async () => {
    await abrirAba(m, "chat");
    await m.waitForTimeout(600);
    await enquadrar(m, 14.25, 11.25, 1.6, 215);
    await menuDoToken(m, "tok-jogador-2", 38);
    await expect(m.getByTestId("menu-token")).toBeVisible();
    await foto(m, "32-menu-de-contexto-token-mestre");
    await m.getByTestId("menu-token-condicoes").click();
    await foto(m, "33-menu-de-contexto-token-condicoes-mestre");
    await m.getByTestId("menu-token-fechar").click();
  });
  await tentar("32 menu do token jogador", async () => {
    await enquadrar(j1, 11.25, 9.75, 1.6, 215);
    await menuDoToken(j1, "tok-jogador-1", 38);
    await foto(j1, "32-menu-de-contexto-token-proprio-jogador");
    await limparTela(j1);
    await j1.mouse.click(700, 600);
  });
  await tentar("34 menu da alca da tocha", async () => {
    await enquadrar(j1, 11.25, 9.75, 1.6, 215);
    const a = (await alcas(j1))[0] as Alca;
    await j1.mouse.click(a.x, a.y, { button: "right" });
    await expect(j1.getByTestId("menu-tocha")).toBeVisible();
    await foto(j1, "34-menu-da-alca-da-tocha-jogador");
    await limparTela(j1);
    await enquadrar(m, 11.25, 9.75, 1.6, 215);
    const am = (await alcas(m))[0] as Alca;
    await m.mouse.click(am.x, am.y, { button: "right" });
    await foto(m, "34-menu-da-alca-da-tocha-mestre");
    await limparTela(m);
  });
  await tentar("35 tocha: dica da alca (hover)", async () => {
    await enquadrar(j1, 11.25, 9.75, 1.6, 215);
    const a = (await alcas(j1))[0] as Alca;
    await j1.mouse.move(a.x, a.y);
    await foto(j1, "35-alca-da-tocha-com-mouse-em-cima-jogador");
  });
  await tentar("36 menu de contexto da cena", async () => {
    await m.getByTestId("menu-cenas").click();
    await m
      .locator('[data-testid="cena-card"][data-cena-id="cena-covil"]')
      .click({ button: "right" });
    await expect(m.getByTestId("menu-cena")).toBeVisible();
    await foto(m, "36-menu-de-contexto-card-da-cena-mestre");
    await limparTela(m);
    await m.getByTestId("menu-cenas").click();
  });
  void j2;
});

// ---------------------------------------------------------------------------------------------
// 4. Janela da ficha e importação de PDF
// ---------------------------------------------------------------------------------------------

test("auditoria 40-59: janela da ficha (cada aba), ficha de NPC e importação de PDF", async ({
  grande,
  request,
}) => {
  test.setTimeout(420_000);
  const { mestre: m, j1 } = await montar(grande, request);

  const abas: AbaDaFicha[] = [
    "principal",
    "magias",
    "caracteristicas",
    "equipamento",
    "notas",
    "configurar",
  ];
  for (const aba of abas) {
    await tentar(`40 ficha ${aba} mestre`, async () => {
      await abrirFicha(m, DARION_ID, aba);
      await foto(m, `40-ficha-darion-aba-${aba}-mestre`);
    });
  }
  await tentar("41 ficha jogador", async () => {
    await m.getByTestId("janela-ficha-fechar").click();
    await abrirFicha(j1, DARION_ID, "principal");
    await foto(j1, "41-ficha-darion-aba-principal-jogador");
    await abrirFicha(j1, DARION_ID, "magias");
    await foto(j1, "41-ficha-darion-aba-magias-jogador");
    await j1.getByTestId("janela-ficha-fechar").click();
  });
  await tentar("42 ficha PJ simples (Aldric)", async () => {
    await abrirFicha(j1, "pers-aldric", "principal");
    await foto(j1, "42-ficha-aldric-principal-jogador");
    await j1.getByTestId("janela-ficha-fechar").click();
  });
  await tentar("43 ficha NPC", async () => {
    await abrirFicha(m, "pers-ogro", "principal");
    await foto(m, "43-ficha-de-npc-ogro-principal-mestre");
    await m.getByTestId("ficha-aba-configurar").click();
    await foto(m, "43-ficha-de-npc-ogro-configurar-mestre");
    await m.getByTestId("janela-ficha-fechar").click();
  });
  await tentar("44 duas janelas e ficha com descanso", async () => {
    await abrirFicha(m, DARION_ID, "principal");
    await m.getByTestId("descanso-longo").click();
    await foto(m, "44-ficha-confirmacao-de-descanso-longo-mestre");
    await m.getByTestId("descanso-confirmar-nao").click();
    await m.getByTestId("janela-ficha-fechar").click();
  });

  // importação de PDF: a tela de revisão
  await tentar("50 revisao de PDF", async () => {
    await abrirAba(m, "fichas");
    await m.getByTestId(`ficha-menu-${DARION_ID}`).click();
    const [seletor] = await Promise.all([
      m.waitForEvent("filechooser"),
      m.getByTestId(`ficha-menu-importar-pdf-${DARION_ID}`).click(),
    ]);
    await seletor.setFiles(PDF);
    await expect(m.getByTestId("revisao-pdf")).toBeVisible({ timeout: 60_000 });
    await foto(m, "50-importar-pdf-revisao-topo-mestre", 800);
    for (const [secao, nome] of [
      ["revisao-secao-atributos", "51-importar-pdf-revisao-atributos"],
      ["revisao-secao-ataques", "52-importar-pdf-revisao-ataques"],
      ["revisao-magias", "53-importar-pdf-revisao-magias"],
      ["revisao-secao-recursos", "54-importar-pdf-revisao-recursos"],
    ] as const) {
      await tentar(nome, async () => {
        const alvo: Locator = m.getByTestId(secao);
        await alvo.scrollIntoViewIfNeeded();
        await foto(m, `${nome}-mestre`);
      });
    }
    await tentar("55 confirmar PDF", async () => {
      await m.getByTestId("revisao-confirmar").click();
      await expect(m.getByTestId("revisao-sobrescrever")).toBeVisible();
      await foto(m, "55-importar-pdf-confirmacao-de-sobrescrever-mestre");
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 5. Paredes, luz, escuro e o editor de cena
// ---------------------------------------------------------------------------------------------

test("auditoria 60-79: paredes, fontes de luz, iluminação, editor de cena e o escuro", async ({
  grande,
  request,
}) => {
  test.setTimeout(420_000);
  const { mestre: m, j1, j2 } = await montar(grande, request);
  await m.getByTestId("menu-ordem-turno").click(); // o painel da ordem cobriria o mapa do mestre

  await tentar("60 modo paredes desenhando", async () => {
    await m.getByTestId("menu-iluminacao").click();
    await m.getByTestId("lanterna-paredes").click();
    await expect(m.getByTestId("painel-paredes")).toBeVisible();
    await foto(m, "60-modo-de-paredes-painel-aberto-mestre");
    await enquadrar(m, 19, 12, 1);
    const a = await pontoNaPagina(m, 6, 15);
    const b = await pontoNaPagina(m, 15, 15);
    const c = await pontoNaPagina(m, 15, 18);
    await m.mouse.click(a.x, a.y);
    await m.mouse.click(b.x, b.y);
    await m.mouse.move(c.x, c.y, { steps: 6 });
    await foto(m, "61-modo-de-paredes-desenhando-segmento-em-andamento-mestre");
    await m.mouse.dblclick(c.x, c.y);
    await foto(m, "62-modo-de-paredes-apos-desenhar-mestre");
    await m.getByTestId("parede-novo-porta").click();
    await foto(m, "63-modo-de-paredes-tipo-porta-mestre");
    await m.getByTestId("paredes-fechar").click();
  });
  await tentar("64 selecionar porta no mapa", async () => {
    await m.getByTestId("menu-iluminacao").click();
    await m.getByTestId("lanterna-paredes").click();
    await enquadrar(m, 11.25, 24, 1.4);
    const porta = await pontoNaPagina(m, 11.25, 24);
    await m.mouse.click(porta.x, porta.y);
    await foto(m, "64-modo-de-paredes-porta-selecionada-mestre");
    await m.getByTestId("paredes-fechar").click();
  });
  await tentar("65 fontes de luz", async () => {
    await m.getByTestId("menu-iluminacao").click();
    await m.getByTestId("lanterna-fontes").click();
    await expect(m.getByTestId("painel-fontes")).toBeVisible();
    await enquadrar(m, 14, 11, 1);
    await foto(m, "65-painel-de-fontes-de-luz-mestre");
    await m.getByTestId("luz-escolher-tocha-1").click();
    await foto(m, "65-painel-de-fontes-de-luz-detalhe-da-tocha-mestre");
    await m.getByTestId("painel-fontes-fechar").click();
  });
  await tentar("66 config iluminacao", async () => {
    await m.getByTestId("menu-iluminacao").click();
    await m.getByTestId("lanterna-config").click();
    await expect(m.getByTestId("painel-config-iluminacao")).toBeVisible();
    await foto(m, "66-painel-de-iluminacao-configuracoes-mestre");
    await m.getByTestId("config-fechar").click();
  });
  await tentar("67 editor de cena", async () => {
    await m.getByTestId("menu-cenas").click();
    await m.locator('[data-testid="cena-card"][data-cena-id="cena-1"]').click({ button: "right" });
    await m.getByTestId("menu-cena-configurar").click();
    await expect(m.getByTestId("configurar-cena")).toBeVisible();
    await foto(m, "67-editor-de-cena-configurar-mestre");
    await m.getByTestId("cfg-cancelar").click();
    await m.getByTestId("menu-cenas").click();
  });
  await tentar("68 configuracoes da mesa e modelos de tocha", async () => {
    await abrirAba(m, "configuracoes");
    await foto(m, "68-configuracoes-da-mesa-modelos-de-tocha-mestre");
    const modelo = m.getByTestId("modelo-modelo-tocha");
    await modelo.locator("summary").click();
    await modelo.scrollIntoViewIfNeeded();
    await foto(m, "68-modelo-de-tocha-aberto-mestre");
  });

  // ---- o escuro: a tocha, a memória do mapa e a visão do mestre ----
  await tentar("70 jogador no escuro com a tocha", async () => {
    await enquadrar(j2, 14.25, 11.25, 1.3);
    await foto(j2, "70-escuro-com-tocha-jogador-brisa-sem-visao-no-escuro");
    await enquadrar(j1, 11.25, 9.75, 1.3);
    await foto(j1, "70-escuro-com-tocha-jogador-aldric-na-mao-da-tocha");
    await enquadrar(m, 14.25, 11.25, 1.3);
    await foto(m, "71-escuro-mesma-cena-visao-do-mestre");
    await m.getByTestId("menu-visao-noturna").click();
    await foto(m, "72-escuro-mesma-cena-visao-noturna-do-mestre");
    await m.getByTestId("menu-visao-noturna").click();
  });
  await tentar("73 memoria do mapa", async () => {
    const j3 = await entrarNoMapa(grande, "jogador-3");
    const p = j3.pagina;
    await recolherLateral(p);
    await levar(m, "tok-jogador-3", 11.25, 29.25);
    await enquadrar(p, 11.25, 27, 1);
    await expect
      .poll(() =>
        p.evaluate(
          () => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.memoria().lembradas,
        ),
      )
      .toBeGreaterThan(200);
    await foto(p, "73-memoria-do-mapa-dentro-da-sala-jogador-cael");
    await enviarCru(m, intencaoCrua("porta.alternar", { id: "par-sala-porta" }));
    await levar(m, "tok-jogador-3", 11.25, 21.75);
    await enquadrar(p, 11.25, 24, 1);
    await enviarCru(m, intencaoCrua("porta.alternar", { id: "par-sala-porta" }));
    await foto(p, "73-memoria-do-mapa-fora-da-sala-jogador-cael", 900);
    await enquadrar(m, 11.25, 24, 1);
    await foto(m, "74-memoria-do-mapa-mesma-cena-visao-do-mestre");
  });
});

// ---------------------------------------------------------------------------------------------
// 6. Tela pequena (1280×720)
// ---------------------------------------------------------------------------------------------

test("auditoria 90-99: tela pequena 1280x720", async ({ pequena, request }) => {
  test.setTimeout(420_000);
  const { mestre: m, j1 } = await montar(pequena, request);

  await tentar("90 mesa em jogo", async () => {
    await abrirAba(m, "chat");
    await foto(m, "90-pequena-1280-mesa-em-jogo-mestre");
    await foto(j1, "90-pequena-1280-mesa-em-jogo-jogador");
  });
  await tentar("91 ficha aberta", async () => {
    await abrirFicha(m, DARION_ID, "principal");
    await foto(m, "91-pequena-1280-ficha-aberta-mestre");
    await m.getByTestId("ficha-aba-magias").click();
    await foto(m, "91-pequena-1280-ficha-aba-magias-mestre");
    await m.getByTestId("janela-ficha-fechar").click();
    await abrirFicha(j1, DARION_ID, "principal");
    await foto(j1, "91-pequena-1280-ficha-aberta-jogador");
    await j1.getByTestId("janela-ficha-fechar").click();
  });
  await tentar("92 painel de fichas", async () => {
    await abrirAba(m, "fichas");
    await foto(m, "92-pequena-1280-painel-de-fichas-mestre");
    await abrirAba(j1, "fichas");
    await foto(j1, "92-pequena-1280-painel-de-fichas-jogador");
  });
  await tentar("93 ordem de turno", async () => {
    await foto(m, "93-pequena-1280-ordem-de-turno-mestre");
    await foto(j1, "93-pequena-1280-ordem-de-turno-jogador");
  });
  await tentar("94 menu superior", async () => {
    await m.getByTestId("menu-iluminacao").click();
    await foto(m, "94-pequena-1280-menu-iluminacao-mestre");
    await limparTela(m);
  });
});
