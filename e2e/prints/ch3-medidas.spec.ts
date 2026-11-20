import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test as base, expect, Mesa } from "../tests/ajudas";
import { entrarNoMapa } from "../tests/ajudasMapa";

// Medidas do lote CH3 (fora do `pnpm verify`): o custo do desfoque Leve contra o Forte e o uso de processador do navegador do
// mestre enquanto grava a sessão. Os números saem no terminal e em `medidas-ch3.json` na pasta de PRINTS_DIR:
//   $env:PRINTS_DIR="<pasta>"; pnpm --filter @tabletop/e2e prints ch3-medidas
// O computador do teste não tem a placa de vídeo do Vilella: valem como comparação entre os níveis, não como valor absoluto.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde as medidas serão gravadas).");
mkdirSync(PASTA, { recursive: true });

base.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

base("o custo do desfoque: Leve (2,5 px) contra Forte (7 px)", async ({ page }) => {
  base.setTimeout(120_000);
  await page.goto("about:blank");
  const resultado = await page.evaluate(() => {
    const W = 640;
    const H = 360;
    const origem = document.createElement("canvas");
    origem.width = W;
    origem.height = H;
    const o = origem.getContext("2d") as CanvasRenderingContext2D;
    for (let i = 0; i < 400; i++) {
      o.fillStyle = `hsl(${(i * 37) % 360} 60% ${20 + ((i * 13) % 50)}%)`;
      o.fillRect((i * 97) % W, (i * 53) % H, 40 + (i % 60), 30 + (i % 40));
    }
    function medir(raio: number, aceleradoPelaLeitura: boolean): number {
      const saida = document.createElement("canvas");
      saida.width = W;
      saida.height = H;
      const ctx = saida.getContext("2d", {
        alpha: false,
        willReadFrequently: aceleradoPelaLeitura,
      }) as CanvasRenderingContext2D;
      const n = 150;
      // aquece
      for (let i = 0; i < 15; i++) {
        ctx.filter = raio > 0 ? `blur(${raio}px)` : "none";
        ctx.drawImage(origem, -raio, -raio, W + raio * 2, H + raio * 2);
        ctx.getImageData(0, 0, 1, 1);
      }
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        ctx.filter = raio > 0 ? `blur(${raio}px)` : "none";
        ctx.drawImage(origem, -raio, -raio, W + raio * 2, H + raio * 2);
        ctx.filter = "none";
        ctx.getImageData(0, 0, 1, 1); // força o desenho a terminar
      }
      return (performance.now() - t0) / n;
    }
    const raios = [0, 2.5, 7, 16];
    const saida: Record<string, Record<string, number[]>> = { gpu: {}, cpu: {} };
    const gpu = saida.gpu as Record<string, number[]>;
    const cpu = saida.cpu as Record<string, number[]>;
    for (const modo of ["gpu", "cpu"] as const) {
      const alvo = modo === "gpu" ? gpu : cpu;
      for (const r of raios) alvo[String(r)] = [];
      for (let rodada = 0; rodada < 5; rodada++) {
        for (const r of raios) alvo[String(r)]?.push(medir(r, modo === "cpu"));
      }
    }
    return saida;
  });
  const resumo: Record<string, Record<string, number>> = {};
  for (const modo of ["gpu", "cpu"]) {
    resumo[modo] = {};
    for (const [raio, v] of Object.entries(resultado[modo] ?? {})) {
      (resumo[modo] as Record<string, number>)[raio] = Math.round(mediana(v) * 100) / 100;
    }
  }
  console.log(
    "MEDIDA desfoque (ms por quadro de 640x360, mediana de 5 rodadas):",
    JSON.stringify(resumo),
  );
  writeFileSync(
    join(PASTA as string, "medidas-ch3-desfoque.json"),
    JSON.stringify(resumo, null, 2),
  );
  expect(Object.keys(resumo.cpu ?? {}).length).toBe(4);
});

type Metricas = { name: string; value: number }[];
async function cpuDe(
  p: Page,
  ms: number,
): Promise<{ cpuPorCento: number; scriptPorCento: number }> {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Performance.enable");
  const ler = async () => {
    const r = (await cdp.send("Performance.getMetrics")) as { metrics: Metricas };
    const get = (n: string) => r.metrics.find((m) => m.name === n)?.value ?? 0;
    return { t: get("Timestamp"), tarefa: get("TaskDuration"), script: get("ScriptDuration") };
  };
  const a = await ler();
  await p.waitForTimeout(ms);
  const b = await ler();
  await cdp.detach();
  const dt = b.t - a.t;
  return {
    cpuPorCento: Math.round(((b.tarefa - a.tarefa) / dt) * 1000) / 10,
    scriptPorCento: Math.round(((b.script - a.script) / dt) * 1000) / 10,
  };
}

base(
  "o processador do navegador do mestre enquanto grava, e os MB por hora",
  async ({ browser, request }) => {
    base.setTimeout(240_000);
    const mesa = new Mesa(browser);
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const abrir = async (usuario: string) => {
        const s = await entrarNoMapa(mesa, usuario);
        await s.contexto.addInitScript(() => {
          (window as unknown as { __tabletopE2E: object }).__tabletopE2E = {
            gravacao: { falaMinimaMs: 20, fimDeFalaMs: 600, trechoMaximoMs: 3000 },
          };
        });
        const [janela] = await Promise.all([
          s.contexto.waitForEvent("page"),
          s.pagina.getByTestId("topo-chamada").click(),
        ]);
        await expect(janela.getByTestId("chamada-antes")).toBeVisible();
        await janela.getByTestId("chamada-entrar").click();
        await expect(janela.getByTestId("chamada-janela")).toBeVisible();
        return janela;
      };
      const m = await abrir("mestre");
      const a = await abrir("jogador-1");
      await a.getByTestId("chamada-camera").click(); // só áudio e a câmera desligada: o custo medido é o da gravação
      await m.getByTestId("chamada-camera").click();
      await expect(m.getByTestId("chamada-quadro-jogador-1")).toBeVisible();
      await m.waitForTimeout(4000);

      const sem = await cpuDe(m, 20_000);
      await m.getByTestId("chamada-gravar").click();
      await m.getByTestId("chamada-gravacao-pasta").click();
      await m.getByTestId("chamada-gravacao-comecar").click();
      await expect(m.getByTestId("chamada-aviso-gravacao")).toBeVisible();
      const inicioDaGravacao = Date.now();
      const tamanho = async () => {
        const lista = await m.evaluate(() =>
          (
            window as unknown as {
              __tabletopPasta: { exportarPasta(): { caminho: string; base64: string }[] };
            }
          ).__tabletopPasta.exportarPasta(),
        );
        const w = lista.filter((x) => x.caminho.endsWith(".wav"));
        return {
          n: w.length,
          bytes: w.reduce((s, x) => s + Math.floor((x.base64.length * 3) / 4), 0),
        };
      };
      await expect
        .poll(async () => (await tamanho()).n, { timeout: 120_000, intervals: [1000] })
        .toBeGreaterThanOrEqual(2);
      const com = await cpuDe(m, 20_000);
      const final = await tamanho();
      const segundos = (Date.now() - inicioDaGravacao) / 1000;
      await m.getByTestId("chamada-gravar").click();

      const resultado = {
        semGravar: sem,
        gravando: com,
        trechos: final.n,
        bytesDosTrechos: final.bytes,
        segundosGravados: Math.round(segundos),
        mbPorHoraDoAudioFalso: Math.round(((final.bytes / segundos) * 3600) / 100_000) / 10,
        bytesPorSegundoDeFala: 32_000,
        mbPorHoraDeFala: Math.round(((32_000 * 3600) / 1_000_000) * 10) / 10,
      };
      console.log("MEDIDA gravação:", JSON.stringify(resultado));
      writeFileSync(
        join(PASTA as string, "medidas-ch3-gravacao.json"),
        JSON.stringify(resultado, null, 2),
      );
    } finally {
      await mesa.fechar();
    }
  },
);
