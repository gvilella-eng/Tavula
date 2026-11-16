import { describe, expect, it } from "vitest";
import { contrasteEntre } from "../contrasteDeCor";
import { IDS_DOS_TEMAS, TEMAS } from "../tema/temas";

/** `color-mix(in srgb, a p%, b)`: a mistura que o CSS do cartão de rolagem faz, calculada aqui. */
function misturar(a: string, p: number, b: string): string {
  const canais = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [ca, cb] = [canais(a), canais(b)];
  const mix = (ca as number[]).map((v, i) =>
    Math.round(v * p + ((cb as number[])[i] ?? 0) * (1 - p)),
  );
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Q5: os pares de cor dos cartões de rolagem, em todos os temas (inclusive os claros, como o Pergaminho).
describe.each(IDS_DOS_TEMAS)("cartão de rolagem no tema %s", (id) => {
  const t = TEMAS[id];

  it("o nome na fita lê bem", () => {
    // a fita é metade borda, metade cabeçalho (`--rc-fita-fundo` no rolagem.css)
    expect(contrasteEntre(t.texto, misturar(t.borda, 0.5, t.cabecalho))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("o número crítico (verde misturado com o texto do tema) é legível sobre o cartão (texto grande: 3:1)", () => {
    const verde = misturar(t.critico, 0.72, t.texto);
    expect(contrasteEntre(verde, t.painel)).toBeGreaterThanOrEqual(3);
  });

  it("a fita crítica (texto escuro sobre o verde fixo) lê bem", () => {
    expect(contrasteEntre(t.criticoTexto, t.critico)).toBeGreaterThanOrEqual(4.5);
  });

  it("o ícone do dano (âmbar do tema) e os rótulos suaves leem sobre o cartão", () => {
    expect(contrasteEntre(t.acentoForte, t.painel)).toBeGreaterThanOrEqual(3);
    expect(contrasteEntre(t.textoSuave, t.painel)).toBeGreaterThanOrEqual(4.5);
  });
});
