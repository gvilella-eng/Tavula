import { describe, expect, it } from "vitest";
import {
  ALFABETO_DO_ID_DE_MESA,
  DO_DA_MESA_LEGADA,
  ehIdDeMesa,
  estadoDeMesaNova,
  gerarIdDeMesa,
  ID_DA_MESA_LEGADA_DE_TESTE,
  nomeDaSala,
  nomeDeMesaValido,
  normalizarIdDeMesa,
} from "./index.ts";

describe("id de mesa", () => {
  it("o alfabeto tem 31 símbolos e nenhum ambíguo", () => {
    expect(ALFABETO_DO_ID_DE_MESA).toHaveLength(31);
    for (const c of "01oli") expect(ALFABETO_DO_ID_DE_MESA).not.toContain(c);
    expect(new Set(ALFABETO_DO_ID_DE_MESA).size).toBe(31);
  });

  it("gera 12 caracteres em grupos de 4, só do alfabeto", () => {
    for (let i = 0; i < 200; i++) {
      const id = gerarIdDeMesa();
      expect(id).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
      expect(ehIdDeMesa(id)).toBe(true);
    }
  });

  it("descarta os bytes que viciariam o sorteio (248 a 255) e mapeia o resto pelo resto da divisão", () => {
    // 255 e 248 são descartados; 0..30 viram os 31 símbolos na ordem.
    const bytes = [255, 248, ...Array.from({ length: 12 }, (_, i) => i), 250];
    let usado = false;
    const id = gerarIdDeMesa(() => {
      if (usado) throw new Error("só devia sortear uma vez");
      usado = true;
      return Uint8Array.from(bytes.concat(new Array(20).fill(0)));
    });
    expect(id.replace(/-/g, "")).toBe(ALFABETO_DO_ID_DE_MESA.slice(0, 12));
  });

  it("a distribuição é uniforme (sem viés grosseiro)", () => {
    const contagem = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      for (const c of gerarIdDeMesa().replace(/-/g, ""))
        contagem.set(c, (contagem.get(c) ?? 0) + 1);
    }
    // 24000 sorteios em 31 símbolos: ~774 cada. Aceita ±25%.
    for (const c of ALFABETO_DO_ID_DE_MESA) {
      const n = contagem.get(c) ?? 0;
      expect(n).toBeGreaterThan(580);
      expect(n).toBeLessThan(970);
    }
  });

  it("normaliza maiúsculas, espaços, sem hífens e o link inteiro", () => {
    const canonico = "k7m2-qx9p-4tdn";
    expect(normalizarIdDeMesa(canonico)).toBe(canonico);
    expect(normalizarIdDeMesa("K7M2-QX9P-4TDN")).toBe(canonico);
    expect(normalizarIdDeMesa("  k7m2 qx9p 4tdn ")).toBe(canonico);
    expect(normalizarIdDeMesa("k7m2qx9p4tdn")).toBe(canonico);
    expect(normalizarIdDeMesa("http://localhost:5173/m/k7m2-qx9p-4tdn")).toBe(canonico);
    expect(normalizarIdDeMesa("https://x.example/m/K7M2-QX9P-4TDN/?a=1#b")).toBe(canonico);
  });

  it("recusa o que não é id", () => {
    for (const ruim of [
      "",
      "k7m2-qx9p",
      "k7m2-qx9p-4tdn-xxxx",
      "k7m2-qx9p-4td0",
      "k7m2-qx9p-4tdo",
      "k7m2-qx9p-4tdl",
      "k7m2-qx9p-4tdi",
      "k7m2-qx9p-4td!",
      "campanha",
      "http://localhost:5173/",
      "x".repeat(5000),
    ]) {
      expect(normalizarIdDeMesa(ruim)).toBeNull();
    }
    expect(ehIdDeMesa("K7M2-QX9P-4TDN")).toBe(false);
  });

  it("o id fixo dos testes é válido", () => {
    expect(ehIdDeMesa(ID_DA_MESA_LEGADA_DE_TESTE)).toBe(true);
  });

  it("a mesa legada continua no Durable Object 'campanha'", () => {
    expect(DO_DA_MESA_LEGADA).toBe("campanha");
    expect(nomeDaSala()).toBe(DO_DA_MESA_LEGADA);
  });
});

describe("nome da mesa", () => {
  it("aceita de 1 a 60 caracteres e limpa as pontas e os controles", () => {
    expect(nomeDeMesaValido("  Masmorra  do   Vilella ")).toBe("Masmorra do Vilella");
    expect(nomeDeMesaValido("a")).toBe("a");
    expect(nomeDeMesaValido("a".repeat(60))).toHaveLength(60);
    expect(nomeDeMesaValido("a\u0000b\nc")).toBe("a b c");
  });
  it("recusa vazio, só espaços, longo demais e o que não é texto", () => {
    expect(nomeDeMesaValido("")).toBeNull();
    expect(nomeDeMesaValido("   ")).toBeNull();
    expect(nomeDeMesaValido("a".repeat(61))).toBeNull();
    expect(nomeDeMesaValido(12)).toBeNull();
    expect(nomeDeMesaValido(undefined)).toBeNull();
  });
});

describe("mesa nova", () => {
  it("nasce vazia: uma cena em branco, só o mestre (V7), sem tokens, fichas nem paredes", () => {
    const e = estadoDeMesaNova(1000);
    expect(e.usuarios.map((u) => u.id)).toEqual(["mestre"]);
    expect(e.usuarios[0]?.papel).toBe("mestre");
    expect(e.cenas).toHaveLength(1);
    expect(e.tokens).toEqual([]);
    expect(e.personagens).toEqual([]);
    expect(e.paredes).toEqual([]);
    expect(e.luzes).toEqual([]);
    expect(e.seq).toBe(0);
  });
});
