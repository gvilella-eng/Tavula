import { describe, expect, it } from "vitest";
import {
  AvaliadorDeFala,
  bitrateDoVideo,
  ehEducado,
  ehEstreita,
  formatarTempo,
  ganhoDaPessoa,
  gravarPreferenciaDePessoa,
  iceServersDoTexto,
  ignoraOferta,
  inicialDe,
  LIMIAR_DE_FALA_LIGA,
  lerPreferenciaDePessoa,
  limitarVolume,
  listaDeNomes,
  mascaraEstaInvertida,
  nivelDasAmostras,
  SEGURAR_FALA_MS,
  VigiaDeFps,
} from "./puras";

describe("negociação sem colisão", () => {
  it("um dos dois é educado, nunca os dois nem nenhum", () => {
    expect(ehEducado("a", "b")).toBe(true);
    expect(ehEducado("b", "a")).toBe(false);
  });

  it("o indelicado ignora a oferta que colide; o educado a aceita; resposta nunca colide", () => {
    expect(ignoraOferta(false, "offer", true, true)).toBe(true);
    expect(ignoraOferta(false, "offer", false, false)).toBe(true);
    expect(ignoraOferta(true, "offer", true, true)).toBe(false);
    expect(ignoraOferta(false, "offer", true, false)).toBe(false);
    expect(ignoraOferta(false, "answer", false, true)).toBe(false);
  });
});

describe("servidores ICE", () => {
  it("sem variável ou com lixo, a lista é vazia (nada da internet)", () => {
    expect(iceServersDoTexto(undefined)).toEqual([]);
    expect(iceServersDoTexto("")).toEqual([]);
    expect(iceServersDoTexto("não é json")).toEqual([]);
    expect(iceServersDoTexto('{"urls":"stun:x"}')).toEqual([]);
  });

  it("lê STUN e TURN e descarta o que não tem urls", () => {
    const lista = iceServersDoTexto(
      JSON.stringify([
        { urls: "stun:stun.exemplo.org:3478" },
        { urls: ["turn:t.exemplo.org"], username: "u", credential: "c" },
        { username: "sem-urls" },
        7,
      ]),
    );
    expect(lista).toEqual([
      { urls: "stun:stun.exemplo.org:3478" },
      { urls: ["turn:t.exemplo.org"], username: "u", credential: "c" },
    ]);
  });
});

describe("bitrate do vídeo", () => {
  it("cai com mais de 3 pessoas", () => {
    expect(bitrateDoVideo(2)).toBeGreaterThan(bitrateDoVideo(4));
    expect(bitrateDoVideo(3)).toBe(bitrateDoVideo(2));
    expect(bitrateDoVideo(4)).toBeGreaterThan(bitrateDoVideo(8));
  });
});

describe("volume por pessoa", () => {
  it("vai de 0 a 200% e o lixo volta para 100", () => {
    expect(limitarVolume(-5)).toBe(0);
    expect(limitarVolume(250)).toBe(200);
    expect(limitarVolume(Number.NaN)).toBe(100);
    expect(limitarVolume(87.6)).toBe(88);
  });

  it("o ganho é 0 se silenciada ou se parei de ouvir", () => {
    expect(ganhoDaPessoa({ volume: 150, silenciado: false }, false)).toBe(1.5);
    expect(ganhoDaPessoa({ volume: 150, silenciado: true }, false)).toBe(0);
    expect(ganhoDaPessoa({ volume: 150, silenciado: false }, true)).toBe(0);
  });

  it("lembra por mesa e pessoa (e sobrevive a localStorage quebrado)", () => {
    const guardado = new Map<string, string>();
    const antigo = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => guardado.get(k) ?? null,
        setItem: (k: string, v: string) => void guardado.set(k, v),
      },
    });
    try {
      gravarPreferenciaDePessoa("m1", "ana", { volume: 40, silenciado: true });
      expect(lerPreferenciaDePessoa("m1", "ana")).toEqual({ volume: 40, silenciado: true });
      expect(lerPreferenciaDePessoa("m2", "ana")).toEqual({ volume: 100, silenciado: false });
      expect(lerPreferenciaDePessoa("m1", "bruno")).toEqual({ volume: 100, silenciado: false });
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: antigo });
    }
    expect(lerPreferenciaDePessoa("m1", "ana")).toEqual({ volume: 100, silenciado: false });
  });
});

describe("quem fala", () => {
  it("o nível: silêncio é 0 e um tom forte passa do limiar", () => {
    expect(nivelDasAmostras(new Uint8Array(256).fill(128))).toBe(0);
    const tom = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 === 0 ? 168 : 88));
    expect(nivelDasAmostras(tom)).toBeGreaterThan(LIMIAR_DE_FALA_LIGA);
    expect(nivelDasAmostras([])).toBe(0);
  });

  it("liga logo, e só desliga depois de um tempo abaixo do limiar baixo", () => {
    const a = new AvaliadorDeFala();
    expect(a.atualizar(0.001, 0)).toBe(false);
    expect(a.atualizar(0.1, 100)).toBe(true);
    // uma pausa curta no meio da frase não desliga
    expect(a.atualizar(0.0, 100 + SEGURAR_FALA_MS - 50)).toBe(true);
    expect(a.atualizar(0.0, 100 + SEGURAR_FALA_MS + 10)).toBe(false);
  });

  it("o nível no meio (entre os dois limiares) segura o anel aceso", () => {
    const a = new AvaliadorDeFala();
    a.atualizar(0.1, 0);
    expect(a.atualizar(0.025, 400)).toBe(true);
    expect(a.atualizar(0.025, 800)).toBe(true);
    expect(a.atualizar(0.0, 900)).toBe(true);
    expect(a.atualizar(0.0, 800 + SEGURAR_FALA_MS)).toBe(false);
  });
});

describe("desfoque", () => {
  it("o vigia desiste depois de 5 s abaixo de 12 quadros por segundo, e perdoa a queda curta", () => {
    const lento = new VigiaDeFps();
    let desistiu = false;
    // ~8 fps durante 7 s
    for (let t = 0; t <= 7_000 && !desistiu; t += 125) desistiu = lento.quadro(t);
    expect(desistiu).toBe(true);

    const ok = new VigiaDeFps();
    let falha = false;
    for (let t = 0; t <= 20_000; t += 40) falha = ok.quadro(t) || falha;
    expect(falha).toBe(false);

    const oscila = new VigiaDeFps();
    let desistiuOscilando = false;
    for (let t = 0; t <= 20_000; t += t % 8_000 < 3_000 ? 125 : 40) {
      desistiuOscilando = oscila.quadro(t) || desistiuOscilando;
    }
    expect(desistiuOscilando).toBe(false);
  });

  it("a máscara ao contrário (meio baixo, borda alta) é detectada", () => {
    const l = 32;
    const a = 32;
    const pessoa = new Float32Array(l * a);
    for (let y = 0; y < a; y++) {
      for (let x = 0; x < l; x++) {
        const dentro = x > l * 0.25 && x < l * 0.75 && y > a * 0.3;
        pessoa[y * l + x] = dentro ? 0.95 : 0.03;
      }
    }
    expect(mascaraEstaInvertida(pessoa, l, a)).toBe(false);
    expect(
      mascaraEstaInvertida(
        pessoa.map((v) => 1 - v),
        l,
        a,
      ),
    ).toBe(true);
    expect(mascaraEstaInvertida(new Float32Array(4), 2, 2)).toBe(false);
  });
});

describe("medidas e textos", () => {
  it("a janela estreita começa abaixo de 560 px", () => {
    expect(ehEstreita(559)).toBe(true);
    expect(ehEstreita(560)).toBe(false);
  });
  it("tempo, inicial e lista de nomes", () => {
    expect(formatarTempo(0)).toBe("0:00");
    expect(formatarTempo(42_000 + 60_000 * 42)).toBe("42:42");
    expect(formatarTempo(3_600_000 + 61_000)).toBe("1:01:01");
    expect(inicialDe("  ana")).toBe("A");
    expect(inicialDe("")).toBe("?");
    expect(listaDeNomes(["Ana"])).toBe("Ana");
    expect(listaDeNomes(["Ana", "Bruno"])).toBe("Ana e Bruno");
    expect(listaDeNomes(["Ana", "Bruno", "Caio"])).toBe("Ana, Bruno e Caio");
  });
});
