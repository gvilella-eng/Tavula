import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { IntencaoSchema, type TipoIntencao } from "../index.ts";
import { camposDoEsquema } from "./camposDoEsquema.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { estaFora, PARIDADE_COM_O_MCP } from "./paridade.ts";
import { CAMPOS_DA_PARIDADE, type EntradaDeCampo } from "./paridadeCampos.ts";

// Q16: a trava da paridade POR CAMPO. Um campo novo dentro de uma intenção (um efeito de zona, um campo do token, da cena,
// da ficha...) tem de ter caminho no MCP, ou ser declarado fora com motivo, em `paridadeCampos.ts`.

const intencoes = IntencaoSchema.options.map((o) => ({
  tipo: o.shape.tipo.value as TipoIntencao,
  campos: camposDoEsquema(o.shape.dados as unknown as z.ZodType),
}));

const camposDaFerramenta = new Map<string, string[]>(
  TODAS_AS_FERRAMENTAS.map((f) => [f.nome, camposDoEsquema(f.entrada as unknown as z.ZodType)]),
);

/** A entrada da tabela que vale para este campo: a exata, ou a de `*` com o prefixo mais longo. */
function entradaDoCampo(
  tabela: Record<string, EntradaDeCampo>,
  campo: string,
): { chave: string; entrada: EntradaDeCampo } | undefined {
  if (campo in tabela) return { chave: campo, entrada: tabela[campo] as EntradaDeCampo };
  let melhor: string | undefined;
  for (const chave of Object.keys(tabela)) {
    if (!chave.endsWith("*")) continue;
    if (!campo.startsWith(chave.slice(0, -1))) continue;
    if (melhor === undefined || chave.length > melhor.length) melhor = chave;
  }
  return melhor === undefined
    ? undefined
    : { chave: melhor, entrada: tabela[melhor] as EntradaDeCampo };
}

/** O caminho vale se a ferramenta tem esse campo, ou um campo de dentro dele. */
function ferramentaTem(campos: readonly string[], caminho: string): boolean {
  return campos.some(
    (c) =>
      c === caminho ||
      c.startsWith(`${caminho}.`) ||
      c.startsWith(`${caminho}[`) ||
      c.startsWith(`${caminho}{`),
  );
}

describe("paridade campo a campo com o MCP (Q16)", () => {
  const comFerramenta = intencoes.filter(
    (i) => !estaFora(PARIDADE_COM_O_MCP[i.tipo]) && i.campos.length > 0,
  );

  it("o `camposDoEsquema` enxerga os objetos de dentro (zona, fluxo, token)", () => {
    const zona = intencoes.find((i) => i.tipo === "zona.criar")?.campos ?? [];
    expect(zona).toContain("zona.efeitos.som.volume");
    expect(zona).toContain("zona.pontos[].x");
    const fluxo = intencoes.find((i) => i.tipo === "fluxo.criar")?.campos ?? [];
    expect(fluxo).toContain("fluxo.nos[].config.quando");
    expect(fluxo).toContain("fluxo.nos[].config.zona");
    expect(fluxo).toContain("fluxo.nos[].config.acao.raioX");
    const token = intencoes.find((i) => i.tipo === "token.editar")?.campos ?? [];
    expect(token).toContain("mudancas.borda");
  });

  it("todo campo de toda intenção com ferramenta tem caminho no MCP ou motivo para ficar de fora", () => {
    const faltam: string[] = [];
    for (const { tipo, campos } of comFerramenta) {
      const tabela = CAMPOS_DA_PARIDADE[tipo] ?? {};
      for (const campo of campos) {
        if (!entradaDoCampo(tabela, campo)) faltam.push(`${tipo}: ${campo}`);
      }
    }
    expect(
      faltam,
      [
        "Campo novo numa intenção sem caminho no MCP:",
        ...faltam.map((f) => `  - ${f}`),
        "O que fazer: (1) ponha o campo na ferramenta do MCP que alcança a intenção (nomes no lugar de ids; descrição curta),",
        'e (2) registre-o em packages/shared/src/mcp/paridadeCampos.ts: "intenção" -> "campo": "ferramenta:caminho na entrada".',
        "Só se for de propósito fora (id, valor que a sala preenche, gesto ao vivo...), declare com `fora(...)` e o motivo.",
      ].join("\n"),
    ).toEqual([]);
  });

  it("todo caminho da tabela existe na entrada da ferramenta apontada", () => {
    const quebrados: string[] = [];
    for (const { tipo, campos } of comFerramenta) {
      const tabela = CAMPOS_DA_PARIDADE[tipo] ?? {};
      for (const campo of campos) {
        const achado = entradaDoCampo(tabela, campo);
        if (!achado || typeof achado.entrada !== "string") continue;
        const [ferramenta, modelo] = achado.entrada.split(":") as [string, string];
        const resto = achado.chave.endsWith("*") ? campo.slice(achado.chave.length - 1) : "";
        const caminho = modelo.endsWith("*") ? modelo.slice(0, -1) + resto : modelo;
        const campos2 = camposDaFerramenta.get(ferramenta);
        if (!campos2) quebrados.push(`${tipo}.${campo}: não existe a ferramenta "${ferramenta}"`);
        else if (!ferramentaTem(campos2, caminho)) {
          quebrados.push(`${tipo}.${campo}: a ferramenta "${ferramenta}" não tem "${caminho}"`);
        }
      }
    }
    expect(quebrados).toEqual([]);
  });

  it("a tabela não guarda linha de campo ou de intenção que não existe mais", () => {
    const sobram: string[] = [];
    for (const [tipo, tabela] of Object.entries(CAMPOS_DA_PARIDADE)) {
      const intencao = intencoes.find((i) => i.tipo === tipo);
      if (!intencao) {
        sobram.push(`${tipo}: a intenção não existe mais`);
        continue;
      }
      if (estaFora(PARIDADE_COM_O_MCP[intencao.tipo])) {
        sobram.push(`${tipo}: a intenção está fora do MCP; tire-a desta tabela`);
        continue;
      }
      for (const chave of Object.keys(tabela)) {
        const casa = chave.endsWith("*")
          ? intencao.campos.some((c) => c.startsWith(chave.slice(0, -1)))
          : intencao.campos.includes(chave);
        if (!casa) sobram.push(`${tipo}: "${chave}" não é mais campo da intenção`);
      }
    }
    expect(sobram).toEqual([]);
  });

  it("quem fica de fora tem categoria e motivo escritos", () => {
    for (const [tipo, tabela] of Object.entries(CAMPOS_DA_PARIDADE)) {
      for (const [campo, e] of Object.entries(tabela)) {
        if (typeof e === "string") continue;
        expect(e.motivo.length, `${tipo}.${campo}`).toBeGreaterThan(10);
      }
    }
  });
});
