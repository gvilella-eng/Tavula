import { describe, expect, it } from "vitest";
import { DetectorDeFala, rmsDoQuadro, type Trecho } from "./detectorDeFala";

// CH3: o detector de fala por energia e o corte em trechos (folga de 300 ms, mínimo de 0,5 s de fala, máximo de 30 s).

const TAXA = 16_000;
const ms = (n: number) => Math.round((n / 1000) * TAXA);

/** Monta um sinal: silêncio ou "fala" (um tom forte) por tantos ms, na ordem. */
function sinal(partes: [tipo: "s" | "f", duracaoMs: number][]): Float32Array {
  const total = partes.reduce((s, [, d]) => s + ms(d), 0);
  const x = new Float32Array(total);
  let pos = 0;
  for (const [tipo, d] of partes) {
    const n = ms(d);
    if (tipo === "f") for (let i = 0; i < n; i++) x[pos + i] = 0.3 * Math.sin(i * 0.3);
    pos += n;
  }
  return x;
}

function cortar(x: Float32Array, bloco = 1600, origemMs = 0): Trecho[] {
  const saida: Trecho[] = [];
  const d = new DetectorDeFala((t) => saida.push(t), {}, origemMs);
  for (let i = 0; i < x.length; i += bloco) d.alimentar(x.slice(i, i + bloco));
  d.encerrar();
  return saida;
}

const duracaoMs = (t: Trecho) => Math.round((t.amostras.length / TAXA) * 1000);

describe("o detector de fala", () => {
  it("o nível de um quadro: silêncio é 0 e o tom passa do limiar do anel verde", () => {
    expect(rmsDoQuadro(new Float32Array(320))).toBe(0);
    expect(rmsDoQuadro(sinal([["f", 20]]))).toBeGreaterThan(0.035);
    expect(rmsDoQuadro(new Float32Array(0))).toBe(0);
  });

  it("corta só a fala, com 300 ms de folga antes e depois, e diz o início em ms", () => {
    const t = cortar(
      sinal([
        ["s", 2000],
        ["f", 1000],
        ["s", 3000],
      ]),
    );
    expect(t).toHaveLength(1);
    expect(t[0]?.inicioMs).toBe(1700);
    expect(duracaoMs(t[0] as Trecho)).toBe(300 + 1000 + 300);
  });

  it("só silêncio não dá trecho nenhum", () => {
    expect(cortar(sinal([["s", 10_000]]))).toEqual([]);
  });

  it("fala de menos de 0,5 s é descartada (um estalo, uma tosse); a de 0,5 s fica", () => {
    expect(
      cortar(
        sinal([
          ["s", 1000],
          ["f", 300],
          ["s", 2000],
        ]),
      ),
    ).toEqual([]);
    expect(
      cortar(
        sinal([
          ["s", 1000],
          ["f", 500],
          ["s", 2000],
        ]),
      ),
    ).toHaveLength(1);
  });

  it("duas falas separadas por uma pausa curta viram um trecho só; por uma longa, dois", () => {
    const junto = cortar(
      sinal([
        ["s", 1000],
        ["f", 800],
        ["s", 400],
        ["f", 800],
        ["s", 2000],
      ]),
    );
    expect(junto).toHaveLength(1);
    expect(duracaoMs(junto[0] as Trecho)).toBe(300 + 800 + 400 + 800 + 300);
    const separado = cortar(
      sinal([
        ["s", 1000],
        ["f", 800],
        ["s", 2000],
        ["f", 800],
        ["s", 2000],
      ]),
    );
    expect(separado).toHaveLength(2);
    expect(separado[0]?.inicioMs).toBe(700);
    expect(separado[1]?.inicioMs).toBe(1000 + 800 + 2000 - 300);
  });

  it("nenhum trecho passa de 30 s: a fala contínua é cortada à força e segue em outro trecho", () => {
    const t = cortar(
      sinal([
        ["s", 1000],
        ["f", 70_000],
        ["s", 2000],
      ]),
    );
    expect(t.length).toBeGreaterThanOrEqual(3);
    for (const x of t) expect(duracaoMs(x)).toBeLessThanOrEqual(30_000);
    // sem buraco nem repetição: cada trecho começa onde o anterior acabou
    for (let i = 1; i < t.length; i++) {
      const anterior = t[i - 1] as Trecho;
      expect(t[i]?.inicioMs).toBe(anterior.inicioMs + duracaoMs(anterior));
    }
  });

  it("o resultado não depende do tamanho dos blocos em que o áudio chega", () => {
    const x = sinal([
      ["s", 1300],
      ["f", 1234],
      ["s", 2222],
      ["f", 777],
      ["s", 1500],
    ]);
    const a = cortar(x, 1600);
    const b = cortar(x, 333);
    const c = cortar(x, 4096);
    expect(b.map((t) => [t.inicioMs, t.amostras.length])).toEqual(
      a.map((t) => [t.inicioMs, t.amostras.length]),
    );
    expect(c.map((t) => [t.inicioMs, t.amostras.length])).toEqual(
      a.map((t) => [t.inicioMs, t.amostras.length]),
    );
  });

  it("a origem soma ao início, e descartar joga fora o que estava em curso", () => {
    const x = sinal([
      ["s", 1000],
      ["f", 1000],
      ["s", 2000],
    ]);
    expect(cortar(x, 1600, 5000)[0]?.inicioMs).toBe(5000 + 700);
    const saida: Trecho[] = [];
    const d = new DetectorDeFala((t) => saida.push(t));
    d.alimentar(sinal([["f", 1000]]));
    d.descartar();
    d.alimentar(sinal([["s", 3000]]));
    d.encerrar();
    expect(saida).toEqual([]);
  });
});
