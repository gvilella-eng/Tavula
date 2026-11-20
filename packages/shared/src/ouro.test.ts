import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Estado,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  limiteDeVisaoDoToken,
  type ObjetoDeLuz,
  processar,
  processarSistema,
  type Token,
} from "./index.ts";
import { tempoDaSala } from "./relogio.ts";

// AU1: o "ouro". A campanha Chama Primordial roda 10 minutos simulados (semente fixa, tokens entrando e saindo das zonas,
// tochas acesas, um botão, uma tocha reacesa) e o que acontece fica guardado em fixtures/ouro/. O motor de fluxos, com a
// conversão dos ciclos e reações, tem de chegar ao MESMO resultado. Para regravar (só de propósito): OURO_GRAVAR=1.

const ARQUIVO = new URL("../../../fixtures/ouro/chama-primordial-10min.json", import.meta.url);
const ler = (nome: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/campanhas/${nome}`, import.meta.url), "utf8"));
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
let n = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `o${++n}`, tipo, dados });

const tocha = (id: string, cenaId: string, x: number, y: number): ObjetoDeLuz => ({
  id,
  cenaId,
  nome: id,
  modeloId: "modelo-tocha",
  portador: { tipo: "cena", x, y },
  luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: false },
  intensidade: 1,
  estado: "acesa",
  saldoMs: 1_800_000,
  acesaDesdeSala: 0,
  duracaoMs: 1_800_000,
  modificadores: [],
  historico: [],
});
const token = (id: string, cenaId: string, x: number, y: number): Token => ({
  id,
  cenaId,
  nome: id,
  cor: "#0f0",
  tamanhoQuadrados: 1,
  x,
  y,
  camada: "tokens",
  oculto: false,
  controladoPor: ["jogador-1"],
});

function montar(rng: ReturnType<typeof fonteComSemente>): Estado {
  const ok = lerExportacao(ler("5e-padrao.json"));
  if (!ok.ok) throw new Error(ok.motivo);
  const base = ok.exportacao.dados as unknown as Estado;
  const r = processar(
    base,
    "mestre",
    intencao("campanha.importar", { dados: ler("chama-primordial.json") }),
    iso(0),
    rng,
  );
  if (!r.ok) throw new Error(r.erro.mensagem);
  const luzes = [
    ...["t1", "t2", "t3", "t4"].map((id, i) => tocha(id, "pulmao", 18 + i, 15)),
    ...["t5", "t6", "t7", "t8"].map((id, i) => tocha(id, "pulmao", 5 + i, 5)),
    tocha("t9", "entrada", 10, 10),
  ];
  const tokens = [
    token("A", "pulmao", 8, 8),
    token("B", "pulmao", 5, 30),
    token("C", "entrada", 8, 8),
  ];
  const rodando = processar(
    { ...r.estado, luzes, tokens },
    "mestre",
    intencao("mesa.retomar"),
    iso(0),
    rng,
  );
  if (!rodando.ok) throw new Error(rodando.erro.mensagem);
  return rodando.estado;
}

type Linha = {
  t: number;
  luzes: Record<string, string>;
  visao: Record<string, number>;
  chat: string[];
};

function simular(): Linha[] {
  const rng = fonteComSemente(20261113);
  let e = montar(rng);
  const linhas: Linha[] = [];
  let anterior = "";
  let vistos = e.chat?.length ?? 0;
  const mestre = (tipo: Intencao["tipo"], dados: object, t: number) => {
    const r = processar(e, "mestre", intencao(tipo, dados), iso(t), rng);
    if (!r.ok) throw new Error(`${tipo}: ${r.erro.mensagem}`);
    e = r.estado;
  };
  for (let t = 1; t <= 600; t++) {
    const sis = processarSistema(e, iso(t), [], rng);
    if (!sis.ok) throw new Error(sis.erro.mensagem);
    e = sis.estado;
    if (t === 50) {
      // O botão "Rajada de vento": no motor antigo era `evento:rajada`; nos fluxos é o fluxo de botão de mesmo nome.
      const fluxo = e.automacoes?.fluxos.find((f) => f.gatilho.tipo === "botao");
      mestre("botao.usar", { botaoId: `evento:${fluxo?.id ?? "rajada"}` }, t);
    }
    if (t === 100) mestre("token.soltar", { id: "A", x: 20, y: 15 }, t);
    if (t === 130) mestre("token.soltar", { id: "C", x: 20, y: 15 }, t);
    if (t === 250) mestre("token.soltar", { id: "A", x: 8, y: 8 }, t);
    if (t === 300) mestre("tocha.alternar", { id: "t5" }, t);
    if (t === 320) mestre("tocha.alternar", { id: "t5" }, t);
    if (t === 400) mestre("token.soltar", { id: "A", x: 40, y: 30 }, t);
    if (t === 500) mestre("token.soltar", { id: "A", x: 8, y: 8 }, t);
    const sala = tempoDaSala(e.relogio, T0 + t * 1000);
    const luzes: Record<string, string> = {};
    for (const l of e.luzes) {
      const vivos = l.modificadores.filter((m) => m.ateSala === undefined || m.ateSala > sala);
      const fator = vivos.reduce((a, m) => a * m.raioX, 1);
      const soma = vivos.reduce((a, m) => a + (m.raioSomaM ?? 0), 0);
      luzes[l.id] =
        `${l.estado}|x${Math.round(fator * 1000) / 1000}|+${soma}|${Math.round((l.saldoMs ?? 0) / 1000)}s`;
    }
    const visao: Record<string, number> = {};
    for (const tk of e.tokens) {
      const lim = limiteDeVisaoDoToken(e.efeitos, tk.id, sala);
      if (lim !== null) visao[tk.id] = lim;
    }
    const chat = (e.chat ?? [])
      .slice(vistos)
      .map((m) => `${m.tipo}|${JSON.stringify(m.visivelPara)}|${m.texto}`);
    vistos = e.chat?.length ?? 0;
    const chave = JSON.stringify([luzes, visao]);
    if (chave !== anterior || chat.length > 0) linhas.push({ t, luzes, visao, chat });
    anterior = chave;
  }
  return linhas;
}

describe("o ouro: a Chama Primordial por 10 minutos", () => {
  it("o motor chega ao mesmo resultado guardado", () => {
    const linhas = simular();
    if (process.env.OURO_GRAVAR === "1" || !existsSync(ARQUIVO)) {
      writeFileSync(ARQUIVO, `${JSON.stringify(linhas, null, 1)}\n`);
    }
    const ouro = JSON.parse(readFileSync(ARQUIVO, "utf8")) as Linha[];
    expect(linhas.length).toBeGreaterThan(10);
    expect(linhas).toEqual(ouro);
  });
});
