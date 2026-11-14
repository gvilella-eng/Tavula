import { describe, expect, it } from "vitest";
import {
  comandoDoClaudeCode,
  comandoParaRemover,
  nomeDoServidorMcp,
  urlDoMcpDaMesa,
} from "./textosDoClaude";

const TOKEN = `tvc_${"Ab1-_".repeat(8)}xyz`;

describe("o comando do Claude Code (12-3)", () => {
  const cmd = comandoDoClaudeCode("http://127.0.0.1:5173", "k7m2-qx9p-4tdn", TOKEN);

  it("é uma linha só, com o transporte, o escopo, o nome com o id da mesa, o endereço e o token", () => {
    expect(cmd).toBe(
      `claude mcp add --transport http --scope user tavola-k7m2-qx9p-4tdn http://127.0.0.1:5173/api/m/k7m2-qx9p-4tdn/mcp --header "Authorization: Bearer ${TOKEN}"`,
    );
    expect(cmd).not.toContain("\n");
  });

  it("vale igual no PowerShell 5.1, no cmd e no bash: só aspas duplas, nada de $, crase, ponto e vírgula, barra invertida ou aspas simples", () => {
    for (const proibido of ["$", "`", ";", "\\", "'", "|", "&", "<", ">", "%", "^"]) {
      expect(cmd).not.toContain(proibido);
    }
    // As aspas duplas só envolvem o valor do cabeçalho (um par).
    expect(cmd.match(/"/g)).toHaveLength(2);
  });

  it("o --header fica por último (a opção aceita vários valores) e o nome só leva letras, números e hífen", () => {
    expect(cmd.lastIndexOf("--header")).toBeGreaterThan(cmd.indexOf("tavola-"));
    expect(cmd.endsWith(`"`)).toBe(true);
    expect(nomeDoServidorMcp("k7m2-qx9p-4tdn")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("a origem vem da página (https inclusive) e o remover usa o mesmo nome", () => {
    expect(urlDoMcpDaMesa("abc", "https://mesa.exemplo.com/qualquer?x=1")).toBe(
      "https://mesa.exemplo.com/api/m/abc/mcp",
    );
    expect(comandoParaRemover("abc")).toBe("claude mcp remove --scope user tavola-abc");
  });
});
