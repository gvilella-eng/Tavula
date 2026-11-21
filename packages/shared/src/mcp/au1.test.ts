import { describe, expect, it } from "vitest";
import {
  automacoesDe,
  fraseDoFluxo,
  GatilhoSchema,
  gatilhoPrincipal,
  nomesDaMesa,
  PORTAS_LOGICAS,
  TIPOS_DE_BLOCO,
  TIPOS_DE_NO,
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
    expect(JSON.stringify(f?.nos)).toContain(
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
    const editado = sala.verdade.automacoes?.fluxos[0];
    expect(editado).toMatchObject({ ligado: false });
    expect(editado && gatilhoPrincipal(editado)).toEqual({ tipo: "relogio", cadaS: 60 });
    // o resto do desenho ficou (a Respiração tem duas trilhas saindo do gatilho)
    expect(editado?.fios.filter((x) => x.de.no === editado.nos[0]?.id)).toHaveLength(2);
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
    expect(ruim.texto).toContain("a ação luz.modificar");
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

describe("AU2: a automação como grafo, pelo MCP", () => {
  const ARMADILHA = {
    nome: "Armadilha",
    nos: [
      // AU3: as portas são caixas e as peças vão dentro delas (`em`: o nome da caixa).
      { nome: "Qualquer entrada", tipo: "caixa", config: { porta: "ou" } },
      {
        nome: "Entra na A",
        tipo: "gatilho",
        em: "Qualquer entrada",
        config: { tipo: "zona", quando: "entra", zona: "Zona A" },
      },
      {
        nome: "Entra na B",
        tipo: "gatilho",
        em: "Qualquer entrada",
        config: { tipo: "zona", quando: "entra", zona: "Zona B" },
      },
      { nome: "Todas", tipo: "caixa", config: { porta: "e" } },
      { nome: "Não é jogador", tipo: "caixa", em: "Todas", config: { porta: "nao" } },
      {
        nome: "É jogador",
        tipo: "condicao",
        em: "Não é jogador",
        config: { condicao: "tokenDeJogador" },
      },
      {
        nome: "Meia chance",
        tipo: "condicao",
        em: "Todas",
        config: { condicao: "chance", chance: 0.5 },
      },
      { nome: "Se", tipo: "se", config: {} },
      { nome: "Cada tocha", tipo: "paraCada", config: { alvo: { tipo: "objetos", acesos: true } } },
      { nome: "Apaga", tipo: "acao", config: { acao: { acao: "objeto.apagar" } } },
    ],
    fios: [
      { de: "Qualquer entrada", para: "Se" },
      { de: "Todas", para: "Se" },
      { de: "Se", saida: "sim", para: "Cada tocha" },
      { de: "Cada tocha", saida: "corpo", para: "Apaga" },
    ],
  };

  async function mesaComZonas(): Promise<SalaSimulada> {
    const sala = await mesaDoPulmao();
    const z = await rodar(sala, "automacoes", {
      zonas: [
        {
          cena: "Pulmão",
          nome: "Zona A",
          pontos: [
            [1, 1],
            [3, 1],
            [3, 3],
          ],
        },
        {
          cena: "Pulmão",
          nome: "Zona B",
          pontos: [
            [6, 6],
            [8, 6],
            [8, 8],
          ],
        },
      ],
    });
    expect(z.erro, z.texto).toBeFalsy();
    return sala;
  }

  it('monta "quando entra na zona A OU na B, se NÃO for jogador E chance 50%, apaga a tocha" por nós e fios', async () => {
    const sala = await mesaComZonas();
    const r = await rodar(sala, "automacoes", { fluxos: [ARMADILHA] });
    expect(r.erro, r.texto).toBeFalsy();
    const f = sala.verdade.automacoes?.fluxos[0];
    expect(f?.nome).toBe("Armadilha");
    expect(f?.rascunho).toBe(true);
    expect(f?.nos).toHaveLength(10);
    expect(f?.fios).toHaveLength(4);
    // nomes viraram ids e cada nó ganhou um lugar na grade
    const zonaA = sala.verdade.zonas?.find((z) => z.nome === "Zona A");
    expect(JSON.stringify(f?.nos)).toContain(zonaA?.id);
    // só as peças soltas na grade ganham lugar; as de dentro das caixas ficam com a caixa
    const soltas = f?.nos.filter((n) => n.em === undefined) ?? [];
    expect(new Set(soltas.map((n) => `${n.x},${n.y}`)).size).toBe(5);
    expect(f?.nos.find((n) => n.em !== undefined)?.em).toBeTruthy();
    const e = await rodar(sala, "automacoes", { explicar: { fluxo: "Armadilha" } });
    expect(e.texto).toContain("zona Zona A");
    expect(e.texto).toContain("zona Zona B");
    expect(e.texto).toContain("NÃO");
    expect(e.texto).toContain("(NÃO o token for de um jogador) e o sorteio de 50% der certo");
    expect(e.texto).toContain("qualquer um destes acontecer");
    expect(e.texto).toContain("50%");
  });

  it("recusa o que não combina numa caixa, com o motivo", async () => {
    const sala = await mesaComZonas();
    const gatilhoEmTodas = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Errada",
          nos: [
            { nome: "Todas", tipo: "caixa", config: { porta: "e" } },
            { nome: "Botão", tipo: "gatilho", em: "Todas", config: { tipo: "botao", nome: "B" } },
            { nome: "Botão 2", tipo: "gatilho", em: "Todas", config: { tipo: "botao", nome: "C" } },
          ],
          fios: [],
        },
      ],
    });
    expect(gatilhoEmTodas.erro).toBe(true);
    expect(gatilhoEmTodas.texto).toContain("use OU");
    const acaoDentro = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Errada2",
          nos: [
            { nome: "Qualquer", tipo: "caixa", config: { porta: "ou" } },
            {
              nome: "Aviso",
              tipo: "acao",
              em: "Qualquer",
              config: { acao: { acao: "chat.anunciar", texto: "x" } },
            },
          ],
          fios: [],
        },
      ],
    });
    expect(acaoDentro.erro).toBe(true);
    expect(automacoesDe(sala.verdade).fluxos).toEqual([]);
  });

  it('monta "a cada 3 min OU botão Combate, para cada tocha acesa, sortear 30%, apaga" com as peças dentro da caixa', async () => {
    const sala = await mesaDoPulmao();
    const r = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Tochas apagam",
          nos: [
            { nome: "Gatilhos", tipo: "caixa", config: { porta: "ou" } },
            {
              nome: "Relógio",
              tipo: "gatilho",
              em: "Gatilhos",
              config: { tipo: "relogio", cadaS: 180 },
            },
            {
              nome: "Combate",
              tipo: "gatilho",
              em: "Gatilhos",
              config: { tipo: "botao", nome: "Combate" },
            },
            {
              nome: "Cada tocha",
              tipo: "paraCada",
              config: { alvo: { tipo: "objetos", acesos: true } },
            },
            { nome: "Sorteio", tipo: "sortear", config: { chance: 0.3 } },
            { nome: "Apaga", tipo: "acao", config: { acao: { acao: "objeto.apagar" } } },
          ],
          fios: [
            { de: "Gatilhos", para: "Cada tocha" },
            { de: "Cada tocha", saida: "corpo", para: "Sorteio" },
            { de: "Sorteio", saida: "sim", para: "Apaga" },
          ],
        },
      ],
    });
    expect(r.erro, r.texto).toBeFalsy();
    const e = await rodar(sala, "automacoes", { explicar: { fluxo: "Tochas apagam" } });
    expect(e.texto).toContain("qualquer um destes acontecer");
    expect(e.texto).toContain("a cada 3 min");
    expect(e.texto).toContain("Combate");
    expect(e.texto).toContain("30%");
  });

  it("monta caixas com N espaços por nome: três gatilhos em OU e duas ações em E, com o espaço inferido", async () => {
    const sala = await mesaDoPulmao();
    const r = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Tres",
          nos: [
            { nome: "Gatilhos", tipo: "caixa", config: { porta: "ou" } },
            { nome: "G1", tipo: "gatilho", em: "Gatilhos", config: { tipo: "botao", nome: "Um" } },
            {
              nome: "G2",
              tipo: "gatilho",
              em: "Gatilhos",
              config: { tipo: "sinal", nome: "dois" },
            },
            { nome: "G3", tipo: "gatilho", em: "Gatilhos", config: { tipo: "turno" } },
            { nome: "Faz tudo", tipo: "caixa", config: { porta: "e" } },
            {
              nome: "A1",
              tipo: "acao",
              em: "Faz tudo",
              config: { acao: { acao: "chat.anunciar", texto: "primeiro" } },
            },
            {
              nome: "A2",
              tipo: "acao",
              em: "Faz tudo",
              config: { acao: { acao: "chat.anunciar", texto: "segundo" } },
            },
          ],
          fios: [{ de: "Gatilhos", para: "Faz tudo" }],
        },
      ],
    });
    expect(r.erro, r.texto).toBeFalsy();
    const f = sala.verdade.automacoes?.fluxos[0];
    const caixaOu = f?.nos.find((n) => n.nome === "Gatilhos");
    expect(caixaOu?.tipo === "caixa" && caixaOu.config.espacos).toBe(3);
    expect(f?.nos.filter((n) => n.em === caixaOu?.id).map((n) => n.espaco)).toEqual([0, 1, 2]);
    const e = await rodar(sala, "automacoes", { explicar: { fluxo: "Tres" } });
    expect(e.texto).toContain("qualquer um destes acontecer");
    expect(e.texto).toContain("avisa no chat: “primeiro”");
    expect(e.texto).toContain("avisa no chat: “segundo”");
  });

  it("os erros do grafo vêm em português, com o nome do nó", async () => {
    const sala = await mesaComZonas();
    const semCondicao = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Quebrada",
          nos: [
            { nome: "Quando", tipo: "gatilho", config: { tipo: "botao", nome: "B" } },
            { nome: "Se", tipo: "se", config: {} },
            {
              nome: "Aviso",
              tipo: "acao",
              config: { acao: { acao: "chat.anunciar", texto: "x" } },
            },
          ],
          fios: [
            { de: "Quando", para: "Se" },
            { de: "Se", saida: "sim", para: "Aviso" },
          ],
        },
      ],
    });
    expect(semCondicao.texto).toContain('o nó "Se"');
    expect(semCondicao.texto).toContain("sem condição");
    const semSaida = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Duvida",
          nos: [
            { nome: "Quando", tipo: "gatilho", config: { tipo: "botao", nome: "B" } },
            { nome: "Sorteio", tipo: "sortear", config: { chance: 0.5 } },
            {
              nome: "Aviso",
              tipo: "acao",
              config: { acao: { acao: "chat.anunciar", texto: "x" } },
            },
          ],
          fios: [
            { de: "Quando", para: "Sorteio" },
            { de: "Sorteio", para: "Aviso" },
          ],
        },
      ],
    });
    expect(semSaida.texto).toContain("mais de uma saída");
    const nomeFantasma = await rodar(sala, "automacoes", {
      fluxos: [
        {
          nome: "Fantasma",
          nos: [{ nome: "Quando", tipo: "gatilho", config: { tipo: "botao", nome: "B" } }],
          fios: [{ de: "Quando", para: "Ninguém" }],
        },
      ],
    });
    expect(nomeFantasma.texto).toContain('"Ninguém"');
    expect(automacoesDe(sala.verdade).fluxos).toEqual([]);
  });

  it("nós e fios trocam o desenho inteiro de uma automação que já existe", async () => {
    const sala = await mesaComZonas();
    await rodar(sala, "automacoes", { fluxos: [ARMADILHA] });
    const nova = {
      nome: "Armadilha",
      nos: [
        { nome: "Botão", tipo: "gatilho", config: { tipo: "botao", nome: "Soltar" } },
        { nome: "Aviso", tipo: "acao", config: { acao: { acao: "chat.anunciar", texto: "oi" } } },
      ],
      fios: [{ de: "Botão", para: "Aviso" }],
    };
    const r = await rodar(sala, "automacoes", { fluxos: [nova] });
    expect(r.erro, r.texto).toBeFalsy();
    const f = automacoesDe(sala.verdade).fluxos[0];
    expect(f?.nos).toHaveLength(2);
    expect(f?.fios).toHaveLength(1);
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

  it("cita cada tipo de nó, cada porta lógica e as portas dos fios (AU2)", async () => {
    const texto = await guia();
    for (const tipo of TIPOS_DE_NO) expect(texto, `nó "${tipo}"`).toContain(`"tipo":"${tipo}"`);
    for (const porta of PORTAS_LOGICAS) expect(texto, `porta "${porta}"`).toContain(`"${porta}"`);
    for (const palavra of [
      "fios",
      "OU",
      "paralelo",
      "espaço",
      "sorteia",
      "NÃO",
      "caixa",
      "condicao",
      "depois",
      "corpo",
    ]) {
      expect(texto).toContain(palavra);
    }
  });

  it("cita cada gatilho, cada condição e cada ação", async () => {
    const texto = await guia();
    for (const o of GatilhoSchema.options) {
      expect(texto, `gatilho ${o.shape.tipo.value}`).toContain(`"tipo":"${o.shape.tipo.value}"`);
    }
    for (const c of [
      "etiqueta",
      "dentroDaZona",
      "cena",
      "zonaLigada",
      "chance",
      "tokenDeJogador",
    ]) {
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

  it("LP1: o roteiro de preparar a sessão fala dos ambientes da cena, não de uma trilha", () => {
    expect(INSTRUCOES).toContain("`ambientesDaCena`");
    expect(INSTRUCOES).not.toContain("trilha da cena");
  });
});
