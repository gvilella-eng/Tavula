import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  automacoesDe,
  type Estado,
  estadoDeMesaNova,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  type ObjetoDeLuz,
  processar,
  processarSistema,
  visaoPara,
} from "./index.ts";

// Lote 7b-3: as duas campanhas prontas (fixtures/campanhas/) passam pelo schema da importação, e a Chama Primordial
// roda: a respiração do Pulmão reduz e apaga as tochas, e nada da história do mestre chega ao jogador.

const ler = (nome: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/campanhas/${nome}`, import.meta.url), "utf8"));

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
let n = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++n}`, tipo, dados });

/**
 * Importa o arquivo como o mestre, deixa o teste mexer no estado (pôr tochas, tokens) e retoma a mesa no instante 0
 * (o arquivo vem com a mesa pausada; o ciclo só começa quando ela corre).
 */
function importar(nome: string, preparar: (e: Estado) => Estado = (e) => e): Estado {
  const base = {
    // um estado qualquer só para o mestre importar por cima
    ...(() => {
      const ok = lerExportacao(ler("5e-padrao.json"));
      if (!ok.ok) throw new Error(ok.motivo);
      return ok.exportacao.dados;
    })(),
  } as unknown as Estado;
  const r = processar(
    base,
    "mestre",
    intencao("campanha.importar", { dados: ler(nome) }),
    iso(0),
    fonteComSemente(1),
  );
  if (!r.ok) throw new Error(`${r.erro.codigo}: ${r.erro.mensagem}`);
  const rodando = processar(
    preparar(r.estado),
    "mestre",
    intencao("mesa.retomar"),
    iso(0),
    fonteComSemente(1),
  );
  if (!rodando.ok) throw new Error(rodando.erro.mensagem);
  return rodando.estado;
}

const tocha = (id: string): ObjetoDeLuz => ({
  id,
  cenaId: "pulmao",
  nome: id,
  modeloId: "modelo-tocha",
  portador: { tipo: "cena", x: 10, y: 10 },
  luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: false },
  intensidade: 1,
  estado: "acesa",
  saldoMs: 1_800_000,
  acesaDesdeSala: 0,
  duracaoMs: 1_800_000,
  modificadores: [],
  historico: [],
});

describe("as campanhas prontas passam pelo schema da importação", () => {
  it("5e padrão: sem nenhuma automação, só com os modelos comuns", () => {
    const lida = lerExportacao(ler("5e-padrao.json"));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    const d = lida.exportacao.dados;
    const a = automacoesDe(d);
    expect(a.fluxos).toEqual([]);
    expect(d.zonas ?? []).toEqual([]);
    expect(d.modelos.map((m) => m.nome)).toEqual(["Tocha 5e", "Lanterna", "Fogueira"]);
  });

  it("Chama Primordial: a tocha de 30 min, a respiração, as reações, as zonas e o farol", () => {
    const lida = lerExportacao(ler("chama-primordial.json"));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    const d = lida.exportacao.dados;
    const tochaModelo = d.modelos.find((m) => m.id === "modelo-tocha");
    expect(tochaModelo).toMatchObject({ nome: "Tocha", duracaoS: 1800, tags: ["chama"] });
    expect(d.config.penalidadeAoApagarS).toBe(60);
    // AU1: o arquivo é da forma antiga (ciclos, reações e botões) e a importação o converte em fluxos
    const a = automacoesDe(d);
    expect(a.legado?.ciclos).toHaveLength(1);
    expect(a.legado?.reacoes).toHaveLength(4);
    expect(a.legado?.botoes).toHaveLength(1);
    const porNome = (n: string) => a.fluxos.find((f) => f.nome === n);
    // o ciclo vira um fluxo de relógio com uma trilha por fase; a expiração só liga ao ciclo e fica dentro dele
    const respiracao = porNome("Respiração do Pulmão");
    expect(respiracao?.gatilho).toEqual({ tipo: "relogio", cadaS: 180 });
    expect(respiracao?.cenas).toEqual(["pulmao"]);
    expect(respiracao?.trilhas).toHaveLength(2);
    expect(JSON.stringify(respiracao?.trilhas[1])).toContain('"visao.limitar"');
    expect(respiracao?.trilhas[1]?.[0]).toEqual({ bloco: "esperar", s: 90 });
    // a inspiração também sai de um botão: fica como sinal, e a tocha ouve o sinal
    expect(JSON.stringify(respiracao?.trilhas[0])).toContain('"sinal"');
    const tocha = porNome("A rajada encolhe e pode apagar a tocha");
    expect(tocha?.gatilho).toEqual({ tipo: "sinal", nome: "inspiracao" });
    expect(JSON.stringify(tocha?.trilhas)).toContain('"modelo":"modelo-tocha"');
    expect(JSON.stringify(tocha?.trilhas)).toContain('"chance":0.3');
    expect(porNome("Rajada de vento")?.gatilho).toEqual({
      tipo: "botao",
      nome: "Rajada de vento",
      cena: "pulmao",
    });
    expect(porNome("Aviso: uma tocha foi reacesa")?.gatilho).toEqual({
      tipo: "tocha",
      muda: "acende",
      etiqueta: "chama",
    });
    expect(porNome("Aviso: alguém entrou no Ar Morto")?.gatilho).toEqual({
      tipo: "zona",
      quando: "entra",
      zona: "zona-ar-morto",
    });
    expect(d.zonas?.map((z) => z.nome)).toEqual(["Ar Morto", "Câmara do Ar Rarefeito"]);
    expect(d.pontos.filter((p) => p.cenaId === "farol" && p.tipo === "suporte")).toHaveLength(2);
    // as cenas não levam imagem (a importação aceita sem)
    expect(d.cenas.every((c) => c.mapa === undefined)).toBe(true);
    expect(d.assets).toEqual([]);
  });
});

describe("a Chama Primordial rodando", () => {
  it("a inspiração reduz o raio da tocha e a rajada pode apagá-la com a penalidade de 5 min", () => {
    // a primeira fase (emS 0) dispara na hora em que o ciclo começa, quando a mesa corre
    const e = importar("chama-primordial.json", (x) => ({
      ...x,
      luzes: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"].map(tocha),
    }));
    const r = processarSistema(e, iso(1), [], fonteComSemente(7));
    if (!r.ok) throw new Error(r.erro.mensagem);
    const depois = e.luzes;
    const apagadas = depois.filter((l) => l.estado !== "acesa");
    const acesas = depois.filter((l) => l.estado === "acesa");
    expect(apagadas.length).toBeGreaterThan(0);
    expect(acesas.length).toBeGreaterThan(0);
    for (const l of acesas) {
      expect(l.modificadores.some((m) => m.raioX === 0.5)).toBe(true);
    }
    // a apagada perde os 5 minutos (a penalidade da rajada) e mais 60 s? não: só os 300 s da ação
    for (const l of apagadas) expect(l.saldoMs).toBeLessThanOrEqual(1_800_000 - 300_000 + 1_000);
    // 20 s depois o raio volta
    const mais = processarSistema(r.estado, iso(25), [], fonteComSemente(8));
    if (!mais.ok) throw new Error(mais.erro.mensagem);
    for (const l of mais.estado.luzes.filter((x) => x.estado === "acesa")) {
      expect(l.modificadores.filter((m) => m.raioX === 0.5)).toEqual([]);
    }
  });

  it("a expiração fecha a visão dos tokens do Pulmão em 1,5 m", () => {
    const e = importar("chama-primordial.json", (x) => ({
      ...x,
      tokens: [
        {
          id: "t1",
          cenaId: "pulmao",
          nome: "Alguém",
          cor: "#0f0",
          tamanhoQuadrados: 1,
          x: 8,
          y: 8,
          camada: "tokens",
          oculto: false,
          controladoPor: ["jogador-1"],
        },
      ],
    }));
    const r = processarSistema(e, iso(91), [], fonteComSemente(1));
    if (!r.ok) throw new Error(r.erro.mensagem);
    expect(r.estado.efeitos?.some((x) => x.alvo.id === "t1" && x.efeito.visaoMaxM === 1.5)).toBe(
      true,
    );
  });

  it("acender uma luz avisa só o mestre (os Gricks)", () => {
    const e = importar("chama-primordial.json");
    const apagada: ObjetoDeLuz = { ...tocha("t1"), estado: "apagada", acesaDesdeSala: undefined };
    const comLuz = { ...e, luzes: [apagada] };
    const r = processar(
      comLuz,
      "mestre",
      intencao("tocha.alternar", { id: "t1" }),
      iso(2),
      fonteComSemente(1),
    );
    if (!r.ok) throw new Error(r.erro.mensagem);
    const sussurros = (r.estado.chat ?? []).filter((m) => m.tipo === "aviso");
    expect(sussurros.length).toBeGreaterThan(0);
    for (const m of sussurros) expect(m.visivelPara).not.toBe("todos");
  });

  it("nada da história do mestre chega ao jogador: nem a visão, nem as notas, nem as zonas", () => {
    const e = importar("chama-primordial.json");
    const v = visaoPara(e, { id: "jogador-1", papel: "jogador" }, T0);
    const json = JSON.stringify(v);
    for (const segredo of ["Grick", "Ar Morto", "Rarefeito", "gás", "Gricks", "tochas"]) {
      expect(json).not.toContain(segredo);
    }
    expect(v.automacoes).toBeUndefined();
    expect(v.zonas).toBeUndefined();
    // o ciclo da campanha não está liberado: o jogador não tem botão nenhum
    expect(v.botoes).toBeUndefined();
  });

  it("a 5e padrão importada roda sem nenhuma automação", () => {
    const e = importar("5e-padrao.json");
    const r = processarSistema(e, iso(500), [], fonteComSemente(1));
    if (!r.ok) throw new Error(r.erro.mensagem);
    expect(automacoesDe(r.estado).fluxos).toEqual([]);
    expect(r.eventos).toEqual([]);
  });
});

describe("Q1: a mesa nova nasce no padrão 5e", () => {
  it("tem os mesmos modelos de luz, regras e pastas do arquivo '5e padrão' e nenhuma automação", () => {
    const lida = lerExportacao(ler("5e-padrao.json"));
    if (!lida.ok) throw new Error(lida.motivo);
    const padrao = lida.exportacao.dados;
    const nova = estadoDeMesaNova(T0);
    expect(nova.modelos).toEqual(padrao.modelos);
    expect(nova.config).toEqual(padrao.config);
    expect(nova.pastas).toEqual(padrao.pastas);
    expect(nova.luzes).toEqual([]);
    expect(automacoesDe(nova).fluxos).toEqual([]);
  });
});
