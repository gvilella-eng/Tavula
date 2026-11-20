import { describe, expect, it } from "vitest";
import {
  contornoDaGota,
  estagioDaChamaDaMao,
  FORMA,
  mascaraDeAlfa,
  montarQuadro,
  RECEITAS,
  regioesConexas,
} from "./chamas";

const ESTILOS = ["tocha", "fogueira"] as const;
const ESTAGIOS = ["forte", "fraca", "morrendo"] as const;
const QUADROS = 16;

/** Pinta (no grid do quadro) o interior de um polígono, pelo teste par-ímpar de cada centro de célula. */
function pintar(
  mascara: Uint8Array,
  larg: number,
  alt: number,
  poligono: Array<[number, number]>,
): void {
  for (let y = 0; y < alt; y++) {
    for (let x = 0; x < larg; x++) {
      let dentro = false;
      for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
        const [xi, yi] = poligono[i] as [number, number];
        const [xj, yj] = poligono[j] as [number, number];
        if (
          yi > y + 0.5 !== yj > y + 0.5 &&
          x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi
        ) {
          dentro = !dentro;
        }
      }
      if (dentro) mascara[y * larg + x] = 1;
    }
  }
}

describe("a silhueta da chama padrão", () => {
  for (const estilo of ESTILOS) {
    for (const estagio of ESTAGIOS) {
      it(`${estilo}, ${estagio}: em todo quadro é uma região só`, () => {
        const forma = FORMA[estilo];
        for (let i = 0; i < QUADROS; i++) {
          const q = montarQuadro(forma, i / QUADROS, estilo, RECEITAS[estilo][estagio]);
          const mascara = new Uint8Array(forma.larg * forma.alt);
          for (const g of q.gotas) pintar(mascara, forma.larg, forma.alt, contornoDaGota(g));
          // as brasas (pontos que sobem) também têm de estar dentro do fogo, nunca soltas dele
          for (const b of q.brasas) {
            const x = Math.floor(b.x);
            const y = Math.floor(b.y);
            expect(mascara[y * forma.larg + x], `brasa solta no quadro ${i}`).toBe(1);
          }
          expect(regioesConexas(mascara, forma.larg, forma.alt), `quadro ${i}`).toBe(1);
        }
      });
    }
  }

  it("a fogueira não tem lenha: nada é desenhado abaixo da base do fogo além do leito de brasas", () => {
    const forma = FORMA.fogueira;
    const q = montarQuadro(forma, 0, "fogueira", RECEITAS.fogueira.forte);
    const fundo = Math.max(...q.gotas.map((g) => g.base + g.largura * 0.28));
    expect(fundo).toBeLessThan(forma.alt * 0.85);
    expect(q.leito.ry).toBeLessThan(q.leito.rx);
  });

  it("a fogueira esticada continua uma massa: as línguas vizinhas se sobrepõem", () => {
    for (const estagio of ESTAGIOS) {
      const forma = FORMA.fogueira;
      const q = montarQuadro(forma, 0.3, "fogueira", RECEITAS.fogueira[estagio]);
      const linguas = q.gotas.slice(1).sort((a, b) => a.x - b.x);
      for (let i = 1; i < linguas.length; i++) {
        const a = linguas[i - 1];
        const b = linguas[i];
        if (!a || !b) continue;
        // a distância entre os centros é menor que a metade das duas larguras: há sobreposição na base
        expect(b.x - a.x).toBeLessThan((a.largura + b.largura) / 2);
      }
    }
  });

  it("é um laço sem emenda: o último quadro vai para o primeiro como um quadro vai ao seguinte", () => {
    const forma = FORMA.tocha;
    const r = RECEITAS.tocha.forte;
    const altura = (t: number) => montarQuadro(forma, t, "tocha", r).gotas[0]?.altura ?? 0;
    const passo = Math.abs(altura(1 / QUADROS) - altura(0));
    expect(Math.abs(altura(1) - altura(0))).toBeLessThan(1e-9);
    expect(Math.abs(altura(1 - 1 / QUADROS) - altura(1))).toBeLessThanOrEqual(passo * 3 + 1);
  });
});

describe("regioesConexas", () => {
  it("conta uma região, duas separadas e a mesma região ligada por um fio", () => {
    const m = new Uint8Array(5 * 3);
    m[0] = 1;
    m[1] = 1;
    expect(regioesConexas(m, 5, 3)).toBe(1);
    m[4] = 1;
    expect(regioesConexas(m, 5, 3)).toBe(2);
    m[2] = 1;
    m[3] = 1;
    expect(regioesConexas(m, 5, 3)).toBe(1);
    // na diagonal não conta como ligado
    const d = new Uint8Array(4);
    d[0] = 1;
    d[3] = 1;
    expect(regioesConexas(d, 2, 2)).toBe(2);
  });

  it("a máscara de alfa respeita o limiar", () => {
    const rgba = [0, 0, 0, 10, 0, 0, 0, 200];
    expect(Array.from(mascaraDeAlfa(rgba, 90))).toEqual([0, 1]);
  });
});

describe("estagioDaChamaDaMao", () => {
  it("a tocha acesa segue o estágio do objeto", () => {
    expect(estagioDaChamaDaMao("acesa", "forte", true)).toBe("forte");
    expect(estagioDaChamaDaMao("acesa", "fraca", true)).toBe("fraca");
    expect(estagioDaChamaDaMao("acesa", "morrendo", true)).toBe("morrendo");
  });
  it("sem estágio (tempo escondido do jogador) vale o forte", () => {
    expect(estagioDaChamaDaMao("acesa", undefined, true)).toBe("forte");
  });
  it("apagada ou sem fogo (lanterna) mantém o ícone", () => {
    expect(estagioDaChamaDaMao("apagada", "forte", true)).toBeNull();
    expect(estagioDaChamaDaMao("acesa", "forte", false)).toBeNull();
  });
});
