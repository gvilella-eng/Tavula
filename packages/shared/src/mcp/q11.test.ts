import { describe, expect, it } from "vitest";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { SalaSimulada } from "./testes/salaSimulada.ts";

// Q11: borda, barra de vida e gestos em lote pelo MCP (paridade com a tela).

async function rodar(sala: SalaSimulada, nome: string, entrada: object): Promise<Saida> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome) as QualquerFerramenta;
  const lida = f.entrada.parse(entrada);
  const s = await f.executar(lida, sala.contexto());
  return typeof s === "string" ? { texto: s } : s;
}

const MESTRE = "m";

async function comHorda() {
  const sala = new SalaSimulada(MESTRE);
  await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", pv: { max: 7 } }] });
  await rodar(sala, "cenas", { cenas: [{ nome: "Eclusa" }] });
  await rodar(sala, "tokens", { colocar: [{ ficha: "Goblin", cena: "Eclusa", quantidade: 3 }] });
  return sala;
}

describe("borda, barra de vida e gestos em lote (Q11)", () => {
  it("`grupo` aplica dano, borda e barra a vários tokens, cada gesto num pedido só", async () => {
    const sala = await comHorda();
    sala.enviados.length = 0;
    const r = await rodar(sala, "tokens", {
      grupo: [
        {
          tokens: ["Goblin", "Goblin 2"],
          cena: "Eclusa",
          vida: -5,
          borda: "vermelho",
          barraDeVida: false,
        },
      ],
    });
    expect(r.erro).toBeFalsy();
    expect(sala.enviados.map((e) => e.tipo)).toEqual(["tokens.vidaDelta", "tokens.editar"]);
    const tokens = sala.visaoDe(MESTRE).tokens;
    expect(tokens.find((t) => t.nome === "Goblin")).toMatchObject({
      pv: { atual: 2, max: 7 },
      borda: "vermelho",
      barraDeVida: false,
    });
    expect(tokens.find((t) => t.nome === "Goblin 3")?.pv?.atual).toBe(7);
    expect(tokens.find((t) => t.nome === "Goblin 3")?.borda).toBeUndefined();
  });

  it("`grupo` com `deslocar` move todos juntos num pedido só, mantendo o arranjo", async () => {
    const sala = await comHorda();
    const antes = sala.visaoDe(MESTRE).tokens.map((t) => ({ nome: t.nome, x: t.x, y: t.y }));
    sala.enviados.length = 0;
    const r = await rodar(sala, "tokens", {
      grupo: [{ tokens: ["Goblin", "Goblin 2", "Goblin 3"], cena: "Eclusa", deslocar: [2, 1] }],
    });
    expect(r.erro).toBeFalsy();
    expect(sala.enviados.map((e) => e.tipo)).toEqual(["tokens.mover"]);
    const depois = sala.visaoDe(MESTRE).tokens;
    for (const a of antes) {
      const t = depois.find((x) => x.nome === a.nome);
      expect(t?.x).toBeCloseTo(a.x + 3, 5);
      expect(t?.y).toBeCloseTo(a.y + 1.5, 5);
    }
  });

  it("`tokens` põe e tira a borda de um token; `fichas` liga e desliga a barra do token padrão", async () => {
    const sala = await comHorda();
    await rodar(sala, "tokens", { tokens: [{ token: "Goblin", cena: "Eclusa", borda: "azul" }] });
    expect(sala.visaoDe(MESTRE).tokens.find((t) => t.nome === "Goblin")?.borda).toBe("azul");
    await rodar(sala, "tokens", { tokens: [{ token: "Goblin", cena: "Eclusa", borda: null }] });
    expect(sala.visaoDe(MESTRE).tokens.find((t) => t.nome === "Goblin")?.borda).toBeUndefined();
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", barraDeVida: false }] });
    expect(
      sala.visaoDe(MESTRE).personagens.find((p) => p.nome === "Goblin")?.tokenPadrao.barraDeVida,
    ).toBe(false);
  });

  it("cor de borda que não existe é recusada", async () => {
    const sala = await comHorda();
    await expect(
      rodar(sala, "tokens", { tokens: [{ token: "Goblin", cena: "Eclusa", borda: "roxo" }] }),
    ).rejects.toThrow();
  });
});
