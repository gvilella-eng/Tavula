import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { capacidadeDaIntencao, IntencaoSchema, PROIBIDAS_AO_CLAUDE } from "../index.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { CATEGORIAS_FORA, estaFora, PARIDADE_COM_O_MCP } from "./paridade.ts";

const TIPOS = IntencaoSchema.options.map((o) => o.shape.tipo.value as string);

/** Os campos de entrada de uma ferramenta, mais os valores de `acao` quando ela tem um. */
function acoesDe(nome: string): Set<string> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome);
  if (!f) return new Set();
  const shape = (f.entrada as unknown as z.ZodObject).shape as Record<string, z.ZodType>;
  const acoes = new Set(Object.keys(shape));
  const acao = shape.acao as unknown as {
    options?: string[];
    unwrap?: () => { options?: string[] };
  };
  const opcoes = acao?.options ?? acao?.unwrap?.().options ?? [];
  for (const o of opcoes) acoes.add(o);
  return acoes;
}

describe("paridade das intenções com o MCP (M2)", () => {
  it("toda intenção do protocolo tem entrada na tabela (intenção nova precisa de entrada)", () => {
    const faltam = TIPOS.filter((t) => !(t in PARIDADE_COM_O_MCP));
    expect(faltam, `Intenções sem entrada em mcp/paridade.ts: ${faltam.join(", ")}`).toEqual([]);
  });

  it("a tabela não guarda intenção que não existe mais", () => {
    const sobram = Object.keys(PARIDADE_COM_O_MCP).filter((t) => !TIPOS.includes(t));
    expect(sobram).toEqual([]);
  });

  it("a ferramenta e o campo apontados existem", () => {
    const quebradas: string[] = [];
    for (const [tipo, e] of Object.entries(PARIDADE_COM_O_MCP)) {
      if (estaFora(e)) continue;
      if (!TODAS_AS_FERRAMENTAS.some((f) => f.nome === e.ferramenta)) {
        quebradas.push(`${tipo}: não existe a ferramenta "${e.ferramenta}"`);
      } else if (!acoesDe(e.ferramenta).has(e.acao)) {
        quebradas.push(`${tipo}: a ferramenta "${e.ferramenta}" não tem "${e.acao}"`);
      }
    }
    expect(quebradas).toEqual([]);
  });

  it("quem fica de fora tem categoria fechada e motivo escrito", () => {
    for (const [tipo, e] of Object.entries(PARIDADE_COM_O_MCP)) {
      if (!estaFora(e)) continue;
      expect(CATEGORIAS_FORA, tipo).toContain(e.fora);
      expect(e.motivo.length, tipo).toBeGreaterThan(10);
    }
  });

  it("o que a sala proíbe ao Claude está fora (proibida ou transporte), e `proibida` é só o que a sala proíbe", () => {
    for (const tipo of Object.keys(PROIBIDAS_AO_CLAUDE)) {
      const e = PARIDADE_COM_O_MCP[tipo as keyof typeof PARIDADE_COM_O_MCP];
      expect(estaFora(e) && (e.fora === "proibida" || e.fora === "transporte"), tipo).toBe(true);
    }
    for (const [tipo, e] of Object.entries(PARIDADE_COM_O_MCP)) {
      if (estaFora(e) && e.fora === "proibida")
        expect(tipo in PROIBIDAS_AO_CLAUDE, tipo).toBe(true);
    }
  });

  it("toda intenção declara a capacidade exigida (ou null de propósito)", () => {
    for (const t of TIPOS) expect(t in capacidadeDaIntencao, t).toBe(true);
  });

  it("todo nome de ferramenta é único e cada uma tem descrição", () => {
    const nomes = TODAS_AS_FERRAMENTAS.map((f) => f.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    for (const f of TODAS_AS_FERRAMENTAS) expect(f.descricao.length).toBeGreaterThan(30);
  });
});
