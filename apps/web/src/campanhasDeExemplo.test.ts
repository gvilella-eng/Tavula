import { lerExportacao } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { CAMPANHAS_DE_EXEMPLO, exemploParaEstaMesa } from "./campanhasDeExemplo";

const mesaDeAgora = {
  usuarios: [
    { id: "vaga-do-mestre", nome: "Gabriel", papel: "mestre" as const, cor: "#d4a017" },
    { id: "vaga-1", nome: "Ana", papel: "jogador" as const, cor: "#3cb44b" },
  ],
  permissoes: {
    jogadores: { "luz.apagar": true },
    porUsuario: { "vaga-1": { "porta.abrir": false } },
  },
};

describe("campanhas de exemplo", () => {
  it("as duas estão na lista, com nome e descrição", () => {
    expect(CAMPANHAS_DE_EXEMPLO.map((c) => c.id)).toEqual(["5e-padrao", "chama-primordial"]);
    for (const c of CAMPANHAS_DE_EXEMPLO) {
      expect(c.nome).not.toBe("");
      expect(c.descricao).not.toBe("");
    }
  });

  it("os arquivos empacotados passam pelo schema da importação", () => {
    for (const c of CAMPANHAS_DE_EXEMPLO) {
      const lida = lerExportacao(JSON.parse(c.texto));
      expect(lida.ok, c.id).toBe(true);
    }
  });

  it("pronto para esta mesa: leva os usuários e as permissões de agora, e o mestre de agora continua mestre", () => {
    for (const c of CAMPANHAS_DE_EXEMPLO) {
      const dados = exemploParaEstaMesa(c.texto, mesaDeAgora as never);
      const lida = lerExportacao(dados);
      expect(lida.ok, c.id).toBe(true);
      if (!lida.ok) continue;
      expect(lida.exportacao.dados.usuarios.map((u) => u.id)).toEqual(["vaga-do-mestre", "vaga-1"]);
      expect(lida.exportacao.dados.permissoes.porUsuario["vaga-1"]).toEqual({
        "porta.abrir": false,
      });
    }
  });

  it("texto que não é JSON dá nulo", () => {
    expect(exemploParaEstaMesa("{", mesaDeAgora as never)).toBeNull();
  });
});
