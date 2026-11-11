import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { arquivoPng, definirMapa } from "../tests/ajudasAssets";
import { ligarOrdem } from "../tests/ajudasCombate";
import { abrirFicha, criarDarion, DARION_ID, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, selecionarToken } from "../tests/ajudasMapa";

// Prints do lote R3 do redesign (janelas flutuantes), nos temas Grimório, Edgerunner e Pergaminho, em
// 1600×900 e 1280×720: as janelas nas posições padrão, arrastadas, a ordem de turno minimizada, a ficha
// redimensionada, cada uma das outras janelas e o seletor de tema. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints r3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const TEMAS = ["grimorio", "escuro", "claro"] as const;
const TAMANHOS = [
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1280x720", width: 1280, height: 720 },
] as const;

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

base.afterAll(() => {
  console.log(`[R3] ${tiradas.length} prints neste arquivo (até aqui).`);
  if (falhas.length) console.log(`[R3] FALHAS:\n - ${falhas.join("\n - ")}`);
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
// Os prints
// ---------------------------------------------------------------------------------------------

const arrastar = async (p: Page, id: string, dx: number, dy: number) => {
  const c = await p.getByTestId(`janela-${id}`).getByRole("toolbar").boundingBox();
  if (!c) throw new Error(`janela ${id} sem cabeçalho`);
  const x = c.x + 14;
  const y = c.y + c.height / 2;
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(x + dx, y + dy, { steps: 8 });
  await p.mouse.up();
};

const test = base;

for (const tamanho of TAMANHOS) {
  for (const tema of TEMAS) {
    test(`janelas ${tema} ${tamanho.nome}`, async ({ browser, request }) => {
      test.setTimeout(240_000);
      const mesa = new Mesa(browser, {
        viewport: { width: tamanho.width, height: tamanho.height },
      });
      try {
        expect((await request.post("/teste/zerar")).ok()).toBe(true);
        const ms = await entrarNoMapa(mesa, "mestre");
        const m = ms.pagina;
        await definirMapa(m, "cena-1", arquivoPng("masmorra.png", pngDaMasmorra(2400, 1800)), 60);
        await m.getByTestId("menu-cenas").click();
        await criarDarion(m);
        await mandar(m, "personagem.colocar", {
          personagemId: DARION_ID,
          cenaId: "cena-1",
          tokenId: "tok-darion",
          x: 9.75,
          y: 12.75,
        });
        await mandar(m, "token.soltar", { id: "tok-jogador-1", x: 11.25, y: 9.75 });
        await mandar(m, "token.soltar", { id: "tok-jogador-2", x: 14.25, y: 11.25 });
        await mandar(m, "token.soltar", { id: "tok-jogador-3", x: 12.75, y: 12.75 });

        // o tema (preferência deste navegador) pelo seletor de verdade
        await m.getByTestId("aba-configuracoes").click();
        await m.getByTestId(`tema-${tema}`).check({ force: true });
        await expect(m.locator("html")).toHaveAttribute("data-tema", tema);
        const rotulo = `${tema}-${tamanho.nome}`;
        await tentar(`${rotulo} seletor`, async () => {
          await m.getByTestId("seletor-de-tema").scrollIntoViewIfNeeded();
          await foto(m, `${rotulo}-10-seletor-de-tema`);
          await m
            .getByTestId("seletor-de-tema")
            .screenshot({ path: join(PASTA as string, `${rotulo}-10-seletor-recorte.png`) });
        });
        await m.getByTestId("aba-chat").click();

        // ordem de turno com o grupo, ficha do Darion e painel do token, nas posições padrão
        await ligarOrdem(m);
        await m.getByTestId("ordem-adicionar-grupo").click();
        await expect(m.getByTestId("ordem-entrada").first()).toBeVisible();
        await selecionarToken(m, "tok-jogador-1");
        await abrirFicha(m, DARION_ID, "principal");
        await expect(m.getByTestId("janela-token")).toBeVisible();
        await tentar(`${rotulo} padrão`, () => foto(m, `${rotulo}-01-padrao`));

        // a ordem de turno minimizada
        await tentar(`${rotulo} minimizada`, async () => {
          await m.getByTestId("janela-ordem-minimizar").click();
          await foto(m, `${rotulo}-02-ordem-minimizada`);
          await m.getByTestId("janela-ordem-minimizar").click();
        });

        // a ficha redimensionada (menor)
        await tentar(`${rotulo} ficha redimensionada`, async () => {
          const alca = await m.getByTestId("janela-ficha-redimensionar").boundingBox();
          if (!alca) throw new Error("sem alça");
          await m.mouse.move(alca.x + 8, alca.y + 8);
          await m.mouse.down();
          await m.mouse.move(alca.x - 40, alca.y - 90, { steps: 6 });
          await m.mouse.up();
          await foto(m, `${rotulo}-03-ficha-redimensionada`);
        });

        // as três arrastadas para outros cantos
        await tentar(`${rotulo} arrastadas`, async () => {
          // a ficha primeiro: no canto de cima ela cobre o cabeçalho do painel do token
          await arrastar(m, `ficha:${DARION_ID}`, 160, 40);
          await arrastar(m, "token", 900, -400);
          await arrastar(m, "ordem", -300, 330);
          await foto(m, `${rotulo}-04-arrastadas`);
        });

        // limpa a tela para as outras janelas
        await m.getByTestId("janela-ficha-fechar").click();
        await m.getByTestId("janela-token-fechar").click();

        await tentar(`${rotulo} fontes`, async () => {
          await m.getByTestId("menu-iluminacao").click();
          await m.getByTestId("lanterna-fontes").click();
          await expect(m.getByTestId("janela-fontes")).toBeVisible();
          await foto(m, `${rotulo}-05-fontes-de-luz`);
          await m.getByTestId("painel-fontes-fechar").click();
        });
        await tentar(`${rotulo} iluminação`, async () => {
          await m.getByTestId("menu-iluminacao").click();
          await m.getByTestId("lanterna-config").click();
          await expect(m.getByTestId("janela-iluminacao")).toBeVisible();
          await foto(m, `${rotulo}-06-iluminacao`);
          await m.getByTestId("config-fechar").click();
        });
        await tentar(`${rotulo} paredes`, async () => {
          await m.getByTestId("menu-iluminacao").click();
          await m.getByTestId("lanterna-paredes").click();
          await expect(m.getByTestId("janela-paredes")).toBeVisible();
          await foto(m, `${rotulo}-07-paredes`);
          await m.getByTestId("paredes-fechar").click();
        });
        await tentar(`${rotulo} dados`, async () => {
          await m.getByTestId("ferramenta-dados").click();
          await expect(m.getByTestId("janela-dados")).toBeVisible();
          await foto(m, `${rotulo}-08-dados-rapidos`);
          await m.getByTestId("janela-dados-fechar").click();
        });

        // duas fichas abertas, a segunda em cascata
        if (tema === "grimorio") {
          await tentar(`${rotulo} cascata`, async () => {
            await abrirFicha(m, DARION_ID, "principal");
            await abrirFicha(m, "pers-aldric", "principal");
            await foto(m, `${rotulo}-09-duas-fichas-em-cascata`);
          });
        }
      } finally {
        await mesa.fechar();
      }
    });
  }
}
