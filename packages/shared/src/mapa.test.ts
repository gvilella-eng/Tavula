import { describe, expect, it } from "vitest";
import {
  criarLimitador,
  encaixarNoGrid,
  INTERVALO_MINIMO_MOVIMENTO_MS,
  limitarNaCena,
  medirRegua,
  PERMISSOES_PADRAO,
  type Permissoes,
  type Personagem,
  podeMoverToken,
  suavizar,
  type Token,
  tokenVisivelPara,
} from "./index.ts";

/** Relógio e agendador falsos: `avancar(ms)` dispara o que vencer no caminho. */
function relogioFalso() {
  let agora = 0;
  let proximoId = 1;
  const tarefas = new Map<number, { quando: number; fn: () => void }>();
  return {
    relogio: {
      agora: () => agora,
      agendar: (fn: () => void, ms: number) => {
        const id = proximoId++;
        tarefas.set(id, { quando: agora + ms, fn });
        return id;
      },
      cancelar: (id: unknown) => {
        tarefas.delete(id as number);
      },
    },
    avancar(ms: number) {
      const fim = agora + ms;
      for (;;) {
        const proxima = [...tarefas.entries()]
          .filter(([, t]) => t.quando <= fim)
          .sort((a, b) => a[1].quando - b[1].quando)[0];
        if (!proxima) break;
        tarefas.delete(proxima[0]);
        agora = Math.max(agora, proxima[1].quando);
        proxima[1].fn();
      }
      agora = fim;
    },
  };
}

describe("limitador de envio", () => {
  it("nunca passa de 20 mensagens por segundo, mesmo com um evento por milissegundo", () => {
    const { relogio, avancar } = relogioFalso();
    const enviados: { t: number; v: number }[] = [];
    const lim = criarLimitador<number>((v) => enviados.push({ t: relogio.agora(), v }), relogio);
    for (let t = 0; t < 5000; t++) {
      avancar(1);
      lim.enviar(t);
    }
    avancar(200);
    // janela deslizante de 1 s: no máximo 20 envios
    for (let i = 0; i < enviados.length; i++) {
      const inicio = enviados[i]?.t ?? 0;
      const naJanela = enviados.filter((e) => e.t >= inicio && e.t < inicio + 1000).length;
      expect(naJanela).toBeLessThanOrEqual(20);
    }
    expect(enviados.length).toBeLessThanOrEqual(101 + 1);
    expect(INTERVALO_MINIMO_MOVIMENTO_MS).toBe(50);
  });

  it("sempre envia a última posição (trailing), mesmo depois de parar", () => {
    const { relogio, avancar } = relogioFalso();
    const enviados: number[] = [];
    const lim = criarLimitador<number>((v) => enviados.push(v), relogio);
    lim.enviar(1); // sai na hora
    lim.enviar(2);
    lim.enviar(3);
    expect(enviados).toEqual([1]);
    avancar(49);
    expect(enviados).toEqual([1]);
    avancar(1);
    expect(enviados).toEqual([1, 3]); // o 2 foi descartado, o 3 (último) saiu
    avancar(1000);
    expect(enviados).toEqual([1, 3]); // nada sobra
  });

  it("depois de um tempo parado, o próximo envio sai na hora", () => {
    const { relogio, avancar } = relogioFalso();
    const enviados: number[] = [];
    const lim = criarLimitador<number>((v) => enviados.push(v), relogio);
    lim.enviar(1);
    avancar(500);
    lim.enviar(2);
    expect(enviados).toEqual([1, 2]);
  });

  it("cancelar descarta o pendente (o soltar sai por fora)", () => {
    const { relogio, avancar } = relogioFalso();
    const enviados: number[] = [];
    const lim = criarLimitador<number>((v) => enviados.push(v), relogio);
    lim.enviar(1);
    lim.enviar(2);
    lim.cancelar();
    avancar(500);
    expect(enviados).toEqual([1]);
  });
});

describe("encaixe no grid (quadrado de 1,5 m)", () => {
  const q = 1.5;
  it("tamanho 1: o centro vai para o meio da célula", () => {
    expect(encaixarNoGrid({ x: 0.2, y: 2.9 }, 1, q)).toEqual({ x: 0.75, y: 2.25 });
    expect(encaixarNoGrid({ x: 1.49, y: 1.51 }, 1, q)).toEqual({ x: 0.75, y: 2.25 });
  });
  it("tamanho 2: o centro vai para a interseção mais próxima", () => {
    expect(encaixarNoGrid({ x: 0.8, y: 2.3 }, 2, q)).toEqual({ x: 1.5, y: 3 });
    expect(encaixarNoGrid({ x: 0.7, y: 0.74 }, 2, q)).toEqual({ x: 0, y: 0 });
  });
  it("tamanho 3 centra na célula e tamanho 4 na interseção", () => {
    expect(encaixarNoGrid({ x: 4.4, y: 4.4 }, 3, q)).toEqual({ x: 3.75, y: 3.75 });
    expect(encaixarNoGrid({ x: 4.4, y: 4.4 }, 4, q)).toEqual({ x: 4.5, y: 4.5 });
  });
  it("respeita outro tamanho de quadrado", () => {
    expect(encaixarNoGrid({ x: 7, y: 7 }, 1, 3)).toEqual({ x: 7.5, y: 7.5 });
    expect(encaixarNoGrid({ x: 7, y: 7 }, 2, 3)).toEqual({ x: 6, y: 6 });
  });
});

describe("régua", () => {
  it("3 quadrados em linha reta = 4,5 m", () => {
    const m = medirRegua({ x: 0.75, y: 0.75 }, { x: 5.25, y: 0.75 }, 1.5);
    expect(m.quadrados).toBe(3);
    expect(m.metros).toBeCloseTo(4.5);
    expect(m.rotulo).toBe("4,5 m (3 quadrados)");
  });
  it("cada diagonal conta 1 quadrado (5e 2014), mas os metros são em linha reta", () => {
    const m = medirRegua({ x: 0, y: 0 }, { x: 4.5, y: 4.5 }, 1.5);
    expect(m.quadrados).toBe(3);
    expect(m.metros).toBeCloseTo(6.364, 3);
    expect(m.rotulo).toBe("6,4 m (3 quadrados)");
  });
  it("mistura de eixos usa o maior; singular para 1; zero", () => {
    expect(medirRegua({ x: 0, y: 0 }, { x: 6, y: 3 }, 1.5).quadrados).toBe(4);
    expect(medirRegua({ x: 0, y: 0 }, { x: 1.5, y: 0 }, 1.5).rotulo).toBe("1,5 m (1 quadrado)");
    expect(medirRegua({ x: 2, y: 2 }, { x: 2, y: 2 }, 1.5).rotulo).toBe("0,0 m (0 quadrados)");
  });
});

describe("posição na cena", () => {
  const cena = { larguraM: 60, alturaM: 45 };
  it("dentro: igual; fora: limitada à borda", () => {
    expect(limitarNaCena({ x: 10, y: 20 }, cena)).toEqual({ x: 10, y: 20 });
    expect(limitarNaCena({ x: -5, y: 99 }, cena)).toEqual({ x: 0, y: 45 });
    expect(limitarNaCena({ x: 61, y: -0.1 }, cena)).toEqual({ x: 60, y: 0 });
  });
});

describe("suavização (interpolação nos outros clientes)", () => {
  it("aproxima do alvo sem passar e encosta exatamente nele", () => {
    let x = 0;
    for (let i = 0; i < 200; i++) {
      x = suavizar(x, 10, 16, 60);
      expect(x).toBeLessThanOrEqual(10);
    }
    expect(x).toBe(10);
  });
});

describe("visibilidade e quem pode mover", () => {
  const token = (extra: Partial<Token> = {}): Token => ({
    id: "t",
    cenaId: "cena-1",
    nome: "T",
    cor: "#fff",
    tamanhoQuadrados: 1,
    x: 1,
    y: 1,
    camada: "tokens",
    oculto: false,
    controladoPor: ["j1"],
    ...extra,
  });
  const mestre = { id: "m", papel: "mestre" as const };
  const j1 = { id: "j1", papel: "jogador" as const };
  const j2 = { id: "j2", papel: "jogador" as const };
  const permissoes: Permissoes = { jogadores: { ...PERMISSOES_PADRAO }, porUsuario: {} };
  /** O que `podeMoverToken` lê do estado: permissões, cena ativa e personagens. */
  const estadoCom = (p: Permissoes, personagens: Personagem[] = []) => ({
    permissoes: p,
    cenaAtivaId: "cena-1",
    personagens,
  });

  it("jogador não vê token oculto nem da camada do mestre; o mestre vê tudo", () => {
    expect(tokenVisivelPara(token(), j1, "cena-1")).toBe(true);
    expect(tokenVisivelPara(token({ oculto: true }), j1, "cena-1")).toBe(false);
    expect(tokenVisivelPara(token({ camada: "mestre" }), j1, "cena-1")).toBe(false);
    expect(tokenVisivelPara(token({ camada: "mestre", oculto: true }), mestre, "cena-1")).toBe(
      true,
    );
    expect(
      tokenVisivelPara(token({ oculto: true }), { id: "a", papel: "assistente" }, "cena-1"),
    ).toBe(false);
  });

  it("o mestre move qualquer token", () => {
    expect(
      podeMoverToken(token({ oculto: true, controladoPor: [] }), mestre, estadoCom(permissoes)),
    ).toBe(true);
  });

  it("o jogador só move o que controla", () => {
    expect(podeMoverToken(token(), j1, estadoCom(permissoes))).toBe(true);
    expect(podeMoverToken(token(), j2, estadoCom(permissoes))).toBe(false);
  });

  it("o jogador precisa de token.moverProprio (padrão ou exceção)", () => {
    const sem: Permissoes = {
      jogadores: { ...PERMISSOES_PADRAO, "token.moverProprio": false },
      porUsuario: {},
    };
    expect(podeMoverToken(token(), j1, estadoCom(sem))).toBe(false);
    const comExcecao: Permissoes = { ...sem, porUsuario: { j1: { "token.moverProprio": true } } };
    expect(podeMoverToken(token(), j1, estadoCom(comExcecao))).toBe(true);
  });

  it("o jogador não move token que controla mas não vê (oculto ou do mestre)", () => {
    expect(podeMoverToken(token({ oculto: true }), j1, estadoCom(permissoes))).toBe(false);
    expect(podeMoverToken(token({ camada: "mestre" }), j1, estadoCom(permissoes))).toBe(false);
  });
});
