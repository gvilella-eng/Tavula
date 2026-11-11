import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { definirDicasLigadas, dicasLigadas } from "./dicasLigadas";
import { TEXTOS_DO_TOUR } from "./textosDoTour";

describe("dicas ao passar o mouse (V3b)", () => {
  it("vêm ligadas por padrão, mesmo sem localStorage", () => {
    expect(dicasLigadas()).toBe(true);
  });

  it("desligar e ligar sem localStorage não quebra e vale na sessão", () => {
    definirDicasLigadas(false);
    expect(dicasLigadas()).toBe(false);
    definirDicasLigadas(true);
    expect(dicasLigadas()).toBe(true);
  });
});

describe("textos do tour", () => {
  const fontes = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? fontes(join(dir, e.name))
        : e.name.endsWith(".tsx")
          ? [readFileSync(join(dir, e.name), "utf8")]
          : [],
    );
  const codigo = fontes(import.meta.dirname).join("\n");

  it("cada id ainda aparece no código da interface (o lote do tour depende disso)", () => {
    // Ids montados no código (`ferramenta-${f.id}` etc.): confere as duas metades.
    const montados: [RegExp, string[]][] = [
      [/^ferramenta-(selecionar|mao|regua)$/, ["ferramenta-$" + "{f.id}", 'id: "$1"']],
      [/^janela-minimizar$/, ["janela-$" + "{id}-minimizar"]],
      [/^lanterna-modelos$/, ['testid="lanterna"', 'id: "modelos"']],
    ];
    const aparece = (id: string) => {
      const regra = montados.find(([re]) => re.test(id));
      if (!regra) return codigo.includes(id);
      return regra[1].every((trecho) => codigo.includes(id.replace(regra[0], trecho)));
    };
    const sumidos = Object.keys(TEXTOS_DO_TOUR).filter((id) => !aparece(id));
    expect(sumidos).toEqual([]);
  });

  it("não há texto vazio", () => {
    for (const [id, texto] of Object.entries(TEXTOS_DO_TOUR)) {
      expect(texto.trim().length, id).toBeGreaterThan(5);
    }
  });
});
