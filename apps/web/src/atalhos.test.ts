import { describe, expect, it } from "vitest";
import {
  ATALHOS,
  atalhosDoGrupo,
  GRUPOS_DE_ATALHOS,
  IDS_DOS_ATALHOS,
  teclasParaAria,
  textoDasTeclas,
} from "./atalhos";

describe("tabela de atalhos", () => {
  it("todo atalho tem descrição, grupo conhecido e ao menos uma tecla", () => {
    for (const id of IDS_DOS_ATALHOS) {
      const a = ATALHOS[id];
      expect(a.descricao.length, id).toBeGreaterThan(3);
      expect(GRUPOS_DE_ATALHOS, id).toContain(a.grupo);
      expect(a.teclas.length, id).toBeGreaterThan(0);
      for (const combo of a.teclas) expect(combo.length, id).toBeGreaterThan(0);
    }
  });

  it("os grupos juntos cobrem a tabela inteira, sem repetir", () => {
    const todos = GRUPOS_DE_ATALHOS.flatMap((g) => atalhosDoGrupo(g).map((x) => x.id));
    expect([...todos].sort()).toEqual([...IDS_DOS_ATALHOS].sort());
  });

  it("as ferramentas de V, H e R são as do código", () => {
    expect(textoDasTeclas(ATALHOS.selecionar.teclas)).toBe("V");
    expect(textoDasTeclas(ATALHOS.mao.teclas)).toBe("H");
    expect(textoDasTeclas(ATALHOS.regua.teclas)).toBe("R");
  });

  it("o menu do token abre com Shift+F10 ou a tecla de menu", () => {
    expect(textoDasTeclas(ATALHOS.menuDoToken.teclas)).toBe("Shift + F10 ou Menu");
    expect(teclasParaAria(ATALHOS.menuDoToken.teclas)).toBe("Shift+F10 ContextMenu");
  });
});
