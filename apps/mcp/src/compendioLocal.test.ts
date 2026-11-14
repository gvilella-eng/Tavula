import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { carregarCompendio } from "./compendioLocal.ts";

const exemplo = JSON.parse(
  readFileSync(new URL("../../../fixtures/compendio/exemplo-srd.json", import.meta.url), "utf8"),
);
const pastas: string[] = [];
const novaPasta = () => {
  const p = mkdtempSync(join(tmpdir(), "tavola-compendio-"));
  pastas.push(p);
  mkdirSync(join(p, "compendio"));
  return p;
};
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const arquivo = (extra: object) =>
  JSON.stringify({ formato: "tabletop-compendio", versao: 1, ...extra });

describe("o compêndio do MCP em stdio (N3a)", () => {
  it("junta os arquivos da pasta compendio/ (magias, monstros e itens)", () => {
    const pasta = novaPasta();
    writeFileSync(join(pasta, "compendio", "magias.json"), arquivo({ magias: exemplo.magias }));
    writeFileSync(
      join(pasta, "compendio", "monstros.json"),
      arquivo({ monstros: exemplo.monstros }),
    );
    writeFileSync(
      join(pasta, "compendio", "itens.json"),
      arquivo({ itensMagicos: exemplo.itensMagicos }),
    );
    const c = carregarCompendio(null, pasta);
    expect(c.resumo()).toMatchObject({ magias: 3, monstros: 3, itensMagicos: 4 });
    expect(c.acharMonstro("Goblin").monstro.nome).toBe("Goblin");
  });

  it("o arquivo antigo, só de magias, continua valendo", () => {
    const pasta = novaPasta();
    writeFileSync(join(pasta, "compendio", "magias.json"), arquivo({ magias: exemplo.magias }));
    expect(carregarCompendio(null, pasta).resumo()).toMatchObject({ magias: 3, monstros: 0 });
  });

  it("o caminho pode ser um arquivo", () => {
    const pasta = novaPasta();
    const f = join(pasta, "compendio", "tudo.json");
    writeFileSync(f, JSON.stringify(exemplo));
    expect(carregarCompendio(f).resumo().monstros).toBe(3);
  });

  it("sem arquivos, ou com um inválido, vale o exemplo do SRD", () => {
    const vazia = novaPasta();
    expect(carregarCompendio(null, vazia).origem).toMatch(/exemplo do SRD/);
    const ruim = novaPasta();
    writeFileSync(join(ruim, "compendio", "monstros.json"), "{ quebrado");
    expect(carregarCompendio(null, ruim).origem).toMatch(/exemplo do SRD/);
  });
});
