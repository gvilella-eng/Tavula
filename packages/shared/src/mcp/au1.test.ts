import { describe, expect, it } from "vitest";
import {
  automacoesDe,
  fraseDoFluxo,
  GatilhoSchema,
  nomesDaMesa,
  TIPOS_DE_BLOCO,
} from "../index.ts";
import { ErroDoMcp } from "./erros.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { INSTRUCOES } from "./servidor.ts";
import { SalaSimulada } from "./testes/salaSimulada.ts";

// AU1: o MCP monta, edita, explica e ensina as automações por blocos. O Claude do mestre usa NOMES (de zona, modelo, cena),
// nunca ids; `guia` conta como as peças funcionam (um teste vigia que nenhuma peça fique de fora) e `explicar` devolve a
// mesma frase do editor.

async function rodar(sala: SalaSimulada, nome: string, entrada: object): Promise<Saida> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome) as QualquerFerramenta;
  const lida = f.entrada.parse(entrada);
  try {
    const s = await f.executar(lida, sala.contexto());
    return typeof s === "string" ? { texto: s } : s;
  } catch (e) {
    if (e instanceof ErroDoMcp) return { texto: e.message, erro: true };
    throw e;
  }
}

/** Uma mesa com a cena "Pulmão" e o modelo de tocha de sempre (o de 5e, "Tocha 5e"). */
async function mesaDoPulmao(): Promise<SalaSimulada> {
  const sala = new SalaSimulada("m");
  const r = await rodar(sala, "cenas", { cenas: [{ nome: "Pulmão" }] });
  expect(r.erro, r.texto).toBeFalsy();
  return sala;
}

const RESPIRACAO = {
  nome: "Respiração do Pulmão",
  cenas: ["Pulmão"],
  gatilho: { tipo: "relogio", cadaS: 180 },
  trilhas: [
    [
      {
        bloco: "paraCada",
        alvo: { tipo: "objetos", modelo: "Tocha 5e", acesos: true },
        corpo: [
          { bloco: "acao", acao: { acao: "luz.modificar", raioX: 0.5, porS: 20 } },
          { bloco: "acao", acao: { acao: "objeto.apagar", chance: 0.3, penalidadeS: 300 } },
        ],
      },
    ],
    [
      { bloco: "esperar", s: 90 },
      {
        bloco: "paraCada",
        alvo: { tipo: "tokens" },
        corpo: [{ bloco: "acao", acao: { acao: "visao.limitar", alcanceM: 1.5, porS: 30 } }],
      },
    ],
  ],
};

describe("a Respiração da Montanha só pelo MCP", () => {
  it("monta pelo nome, entra como rascunho e `explicar` devolve a frase", async () => {
    const sala = await mesaDoPulmao();
    const r = await rodar(sala, "automacoes", { fluxos: [RESPIRACAO] });
    expect(r.erro, r.texto).toBeFalsy();
    const f = sala.verdade.automacoes?.fluxos[0];
    expect(f?.nome).toBe("Respiração do Pulmão");
    expect(f?.rascunho).toBe(true);
    // nomes viraram ids
    const pulmao = sala.verdade.cenas.find((c) => c.nome === "Pulmão");
    expect(f?.cenas).toEqual([pulmao?.id]);
    expect(JSON.stringify(f?.trilhas)).toContain(
      sala.verdade.modelos.find((m) => m.nome === "Tocha 5e")?.id,
    );

    const e = await rodar(sala, "automacoes", { explicar: { fluxo: "Respiração do Pulmão" } });
    expect(e.texto).toContain(
      "A cada 3 min, na cena Pulmão: cada tocha 5e acesa fica com metade da luz por 20 s e tem 30% de chance de apagar (perde 5 min). 90 s depois, a visão de cada token na cena Pulmão cai para 1,5 m por 30 s.",
    );
    // sem nome: todas
    const todas = await rodar(sala, "automacoes", { explicar: {} });
    expect(todas.texto).toContain("Respiração do Pulmão");
    // a mesma função pura que a lista e o editor usam
    const frase = fraseDoFluxo(f as NonNullable<typeof f>, nomesDaMesa(sala.verdade));
    expect(e.texto).toContain(frase);
    // e nenhum id aparece na frase
    expect(frase).not.toContain(pulmao?.id as string);
  });

  it("editar pelo nome troca só o que veio; o erro de validação diz onde e o quê", async () => {
    const sala = await mesaDoPulmao();
    await rodar(sala, "automacoes", { fluxos: [RESPIRACAO] });
    const ed = await rodar(sala, "automacoes", {
      fluxos: [
        { nome: "Respiração do Pulmão", ligado: false, gatilho: { tipo: "relogio", cadaS: 60 } },
      ],
    });
    expect(ed.erro, ed.texto).toBeFalsy();
    expect(sala.verdade.automacoes?.fluxos[0]).toMatchObject({
      ligado: false,
      gatilho: { tipo: "relogio", cadaS: 60 },
    });
    expect(sala.verdade.automacoes?.fluxos[0]?.trilhas).toHaveLength(2);
    // ação de luz solta, sem "para cada": o MCP diz em português, com o lugar
    const ruim = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Solta",
          gatilho: { tipo: "relogio", cadaS: 30 },
          trilhas: [[{ bloco: "acao", acao: { acao: "luz.modificar", raioX: 0.5 } }]],
        },
      ],
    });
    expect(ruim.texto).toContain("trilha 1, bloco 1");
    expect(ruim.texto).toContain("para cada");
    // zona que não existe
    const semZona = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Armadilha",
          gatilho: { tipo: "zona", quando: "entra", zona: "Poça" },
          trilhas: [[{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "oi" } }]],
        },
      ],
    });
    expect(semZona.texto).toMatch(/zona/);
    expect(automacoesDe(sala.verdade).fluxos).toHaveLength(1);
    // apagar pelo nome
    const ap = await rodar(sala, "automacoes", {
      fluxos: [{ nome: "Respiração do Pulmão", apagar: true }],
    });
    expect(ap.erro, ap.texto).toBeFalsy();
    expect(automacoesDe(sala.verdade).fluxos).toEqual([]);
  });

  it("ligar, desligar e disparar pelo `acionar`", async () => {
    const sala = await mesaDoPulmao();
    await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Aviso",
          gatilho: { tipo: "botao", nome: "Avisar" },
          trilhas: [[{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "dito" } }]],
        },
      ],
    });
    // o rascunho do Claude não roda: o mestre publica antes
    await rodar(sala, "rascunhos", { acao: "publicar" });
    const d = await rodar(sala, "automacoes", { acionar: [{ fluxo: "Aviso", acao: "disparar" }] });
    expect(d.erro, d.texto).toBeFalsy();
    expect((sala.verdade.chat ?? []).some((m) => m.texto === "dito")).toBe(true);
    await rodar(sala, "automacoes", { acionar: [{ fluxo: "Aviso", acao: "desligar" }] });
    expect(automacoesDe(sala.verdade).fluxos[0]?.ligado).toBe(false);
    await rodar(sala, "automacoes", { acionar: [{ fluxo: "Aviso", acao: "ligar" }] });
    expect(automacoesDe(sala.verdade).fluxos[0]?.ligado).toBe(true);
  });
});

describe("o guia das automações", () => {
  async function guia(): Promise<string> {
    const sala = await mesaDoPulmao();
    const r = await rodar(sala, "automacoes", { guia: true });
    expect(r.erro, r.texto).toBeFalsy();
    return r.texto;
  }

  it("cita cada tipo de bloco que existe: bloco novo sem estar no guia reprova", async () => {
    const texto = await guia();
    for (const tipo of TIPOS_DE_BLOCO)
      expect(texto, `bloco "${tipo}"`).toContain(`"bloco":"${tipo}"`);
  });

  it("cita cada gatilho, cada condição e cada ação", async () => {
    const texto = await guia();
    for (const o of GatilhoSchema.options) {
      expect(texto, `gatilho ${o.shape.tipo.value}`).toContain(`"tipo":"${o.shape.tipo.value}"`);
    }
    for (const c of ["etiqueta", "dentroDaZona", "cena", "zonaLigada"]) {
      expect(texto, `condição ${c}`).toContain(`"condicao":"${c}"`);
    }
    for (const a of [
      "luz.modificar",
      "objeto.apagar",
      "objeto.ajustarTempo",
      "visao.limitar",
      "chat.anunciar",
      "som.tocar",
      "token.mostrar",
      "token.ocultar",
      "zona.ativar",
    ]) {
      expect(texto, `ação ${a}`).toContain(`"acao":"${a}"`);
    }
  });

  it('explica prazos, sinais, limites e o que "nada fica preso" quer dizer', async () => {
    const texto = await guia();
    for (const trecho of [
      "PRAZOS",
      "Nada fica preso",
      "LIMITES",
      "sinal",
      "tempo da mesa",
      "paraCada",
    ]) {
      expect(texto).toContain(trecho);
    }
  });

  it("as instruções do servidor mandam chamar o guia e o explicar antes de responder", () => {
    expect(INSTRUCOES).toContain("`automacoes`");
    expect(INSTRUCOES).toContain("`guia`");
    expect(INSTRUCOES).toContain("`explicar`");
  });
});
