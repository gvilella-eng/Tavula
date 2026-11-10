import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assetVisivelPara,
  buscarMagias,
  CompendioSchema,
  chatParaUsuario,
  criarExportacao,
  descricaoParaFicha,
  type Estado,
  estadoInicial,
  eventoPara,
  FichaSchema,
  fichaTemMagia,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  LIMITES_DO_COMPENDIO,
  lerCompendio,
  lerExportacao,
  type MagiaDoCompendio,
  type Mensagem,
  MensagemSchema,
  magiaParaFicha,
  normalizarBusca,
  opcoesDeFiltro,
  processar,
  reduzir,
  VERSAO_EXPORTACAO,
  validarMeta,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const TEXTO_DO_EXEMPLO = readFileSync(
  new URL("../../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  "utf8",
);
const HASH = "c".repeat(64);
const OUTRO_HASH = "d".repeat(64);

const exemplo = () => {
  const r = lerCompendio(TEXTO_DO_EXEMPLO);
  if (!r.ok) throw new Error(r.motivo);
  return r.compendio;
};

const magia = (extra: Partial<MagiaDoCompendio> = {}): MagiaDoCompendio => ({
  nome: "Raio de Teste",
  nivel: 2,
  escola: "Evocação",
  tempo: "1 ação",
  alcance: "9 metros",
  componentes: "V, S",
  duracao: "Instantânea",
  concentracao: false,
  ritual: false,
  classes: ["Mago"],
  descricao: "Um raio de teste.",
  ...extra,
});

describe("formato do compêndio", () => {
  it("aceita o exemplo do SRD, com os créditos", () => {
    const c = exemplo();
    expect(c.magias.map((m) => m.nome)).toEqual([
      "Bola de Fogo",
      "Mísseis Mágicos",
      "Detectar Magia",
    ]);
    expect(c.creditos).toContain("CC-BY-4.0");
    expect(c.magias.find((m) => m.nomeOriginal === "Detect Magic")).toMatchObject({
      ritual: true,
      concentracao: true,
      nivel: 1,
    });
  });

  it("o exemplo só tem 3 magias (nenhum outro texto com direitos autorais)", () => {
    expect(exemplo().magias).toHaveLength(3);
  });

  it("recusa campo fora do limite, dizendo a magia e o campo", () => {
    const longa = JSON.parse(TEXTO_DO_EXEMPLO);
    longa.magias[1].descricao = "x".repeat(LIMITES_DO_COMPENDIO.descricao + 1);
    const r = lerCompendio(JSON.stringify(longa));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("magia 2, campo descricao: passa de 12000 caracteres");

    const nivel = JSON.parse(TEXTO_DO_EXEMPLO);
    nivel.magias[2].nivel = 10;
    const r2 = lerCompendio(JSON.stringify(nivel));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.motivo).toBe("magia 3, campo nivel: precisa ser no máximo 9");
  });

  it("recusa nome grande, classe demais, formato e versão errados", () => {
    const base = JSON.parse(TEXTO_DO_EXEMPLO);
    const com = (f: (c: typeof base) => void) => {
      const c = JSON.parse(JSON.stringify(base));
      f(c);
      return lerCompendio(JSON.stringify(c)).ok;
    };
    expect(com((c) => (c.magias[0].nome = "n".repeat(LIMITES_DO_COMPENDIO.nome + 1)))).toBe(false);
    expect(com((c) => (c.magias[0].classes = Array.from({ length: 21 }, (_, i) => `c${i}`)))).toBe(
      false,
    );
    expect(com((c) => (c.formato = "outro"))).toBe(false);
    expect(com((c) => (c.versao = 2))).toBe(false);
    expect(com((c) => delete c.magias[0].tempo)).toBe(false);
    expect(com((c) => (c.magias[0].concentracao = "sim"))).toBe(false);
    expect(com((c) => (c.creditos = "c".repeat(LIMITES_DO_COMPENDIO.creditos + 1)))).toBe(false);
  });

  it("limita o total: magias demais e arquivo grande demais", () => {
    const muitas = {
      formato: "tabletop-compendio",
      versao: 1,
      magias: Array.from({ length: LIMITES_DO_COMPENDIO.magias + 1 }, (_, i) => ({
        ...magia(),
        nome: `Magia ${i}`,
      })),
    };
    expect(CompendioSchema.safeParse(muitas).success).toBe(false);
    const grande = lerCompendio(" ".repeat(LIMITES_DO_COMPENDIO.bytes + 1));
    expect(grande.ok).toBe(false);
    if (!grande.ok) expect(grande.motivo).toMatch(/MB/);
  });

  it("recusa JSON quebrado e nome repetido (sem acento nem caixa)", () => {
    const quebrado = lerCompendio("{ não é json");
    expect(quebrado).toEqual({ ok: false, motivo: "O arquivo não é um JSON válido." });
    const repetido = JSON.parse(TEXTO_DO_EXEMPLO);
    repetido.magias[1].nome = "BOLA DE FOGO";
    const r = lerCompendio(JSON.stringify(repetido));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/magia 2, campo nome.*magia 1/);
  });

  it("diz o problema em português: campo ausente, tipo errado, vazio, lista grande, formato", () => {
    // biome-ignore lint/suspicious/noExplicitAny: edita o JSON do exemplo campo a campo
    const motivo = (f: (c: Record<string, any>) => void) => {
      const c = JSON.parse(TEXTO_DO_EXEMPLO);
      f(c);
      const r = lerCompendio(JSON.stringify(c));
      return r.ok ? "ok" : r.motivo;
    };
    expect(motivo((c) => delete c.magias[0].tempo)).toBe("magia 1, campo tempo: campo obrigatório");
    expect(motivo((c) => (c.magias[1].ritual = "sim"))).toBe(
      "magia 2, campo ritual: precisa ser verdadeiro ou falso",
    );
    expect(motivo((c) => (c.magias[1].nivel = 1.5))).toBe(
      "magia 2, campo nivel: precisa ser um número inteiro",
    );
    expect(motivo((c) => (c.magias[0].nome = "  "))).toBe(
      "magia 1, campo nome: não pode ficar vazio",
    );
    expect(
      motivo((c) => (c.magias[0].classes = Array.from({ length: 21 }, (_, i) => `c${i}`))),
    ).toBe("magia 1, campo classes: tem itens demais (no máximo 20)");
    expect(motivo((c) => (c.formato = "outro"))).toBe(
      'formato: valor inesperado (o esperado é "tabletop-compendio")',
    );
    expect(motivo((c) => delete c.magias)).toBe("magias: campo obrigatório");
  });

  it("aceita um arquivo com BOM e sem créditos", () => {
    const sem = JSON.parse(TEXTO_DO_EXEMPLO);
    delete sem.creditos;
    expect(lerCompendio(`﻿${JSON.stringify(sem)}`).ok).toBe(true);
  });
});

describe("busca e filtros", () => {
  const magias = exemplo().magias;
  const nomes = (r: MagiaDoCompendio[]) => r.map((m) => m.nome);

  it("normaliza sem acento e sem caixa", () => {
    expect(normalizarBusca("  Mísseis MÁGICOS ")).toBe("misseis magicos");
  });

  it("acha por nome, sem acento e sem caixa", () => {
    expect(nomes(buscarMagias(magias, { texto: "bola" }))).toEqual(["Bola de Fogo"]);
    expect(nomes(buscarMagias(magias, { texto: "MISSEIS" }))).toEqual(["Mísseis Mágicos"]);
    expect(nomes(buscarMagias(magias, { texto: "foguete" }))).toEqual([]);
    expect(nomes(buscarMagias(magias, { texto: "detectar mag" }))).toEqual(["Detectar Magia"]);
  });

  it("acha pelo nome original e exige todas as palavras", () => {
    expect(nomes(buscarMagias(magias, { texto: "fireball" }))).toEqual(["Bola de Fogo"]);
    expect(nomes(buscarMagias(magias, { texto: "magic" }))).toEqual([
      "Detectar Magia",
      "Mísseis Mágicos",
    ]);
    expect(nomes(buscarMagias(magias, { texto: "bola missile" }))).toEqual([]);
  });

  it("sem filtro devolve tudo em ordem alfabética", () => {
    expect(nomes(buscarMagias(magias))).toEqual([
      "Bola de Fogo",
      "Detectar Magia",
      "Mísseis Mágicos",
    ]);
  });

  it("filtra por nível, escola, classe, concentração e ritual", () => {
    expect(nomes(buscarMagias(magias, { nivel: 1 }))).toEqual([
      "Detectar Magia",
      "Mísseis Mágicos",
    ]);
    expect(nomes(buscarMagias(magias, { nivel: 0 }))).toEqual([]);
    expect(nomes(buscarMagias(magias, { escola: "adivinhacao" }))).toEqual(["Detectar Magia"]);
    expect(nomes(buscarMagias(magias, { classe: "bardo" }))).toEqual(["Detectar Magia"]);
    expect(nomes(buscarMagias(magias, { classe: "Mago" }))).toHaveLength(3);
    expect(nomes(buscarMagias(magias, { concentracao: true }))).toEqual(["Detectar Magia"]);
    expect(nomes(buscarMagias(magias, { concentracao: false }))).toEqual([
      "Bola de Fogo",
      "Mísseis Mágicos",
    ]);
    expect(nomes(buscarMagias(magias, { ritual: true }))).toEqual(["Detectar Magia"]);
    expect(nomes(buscarMagias(magias, { ritual: false }))).toHaveLength(2);
  });

  it("combina os filtros", () => {
    expect(nomes(buscarMagias(magias, { nivel: 1, concentracao: false, texto: "m" }))).toEqual([
      "Mísseis Mágicos",
    ]);
    expect(nomes(buscarMagias(magias, { nivel: 3, ritual: true }))).toEqual([]);
  });

  it("lista as escolas e classes que existem", () => {
    const o = opcoesDeFiltro(magias);
    expect(o.escolas).toEqual(["Adivinhação", "Evocação"]);
    expect(o.classes).toContain("Patrulheiro");
    expect(new Set(o.classes).size).toBe(o.classes.length);
  });
});

describe("magia para a ficha", () => {
  const bola = exemplo().magias[0] as MagiaDoCompendio;
  const detectar = exemplo().magias[2] as MagiaDoCompendio;

  it("monta a descrição com os campos e a ficha a aceita", () => {
    const m = magiaParaFicha(bola);
    expect(m).toMatchObject({
      nome: "Bola de Fogo",
      nivel: 3,
      escola: "Evocação",
      preparada: true,
    });
    expect(m.descricao).toContain("Tempo de conjuração: 1 ação");
    expect(m.descricao).toContain("Alcance: 45 metros (150 pés)");
    expect(m.descricao).toContain("Componentes: V, S, M");
    expect(m.descricao).toContain("Duração: Instantânea");
    expect(m.descricao).toContain("8d6");
    expect(m.descricao).toContain("Em níveis superiores: Quando você conjura");
    expect(m.descricao).not.toContain("Concentração");
    expect(FichaSchema.safeParse({ pvAtual: 1, pvMax: 1, magias: [m] }).success).toBe(true);
  });

  it("marca concentração e ritual; sem 'Em níveis superiores' quando não há", () => {
    const d = descricaoParaFicha(detectar);
    expect(d).toContain("Concentração · Ritual");
    expect(d).not.toContain("Em níveis superiores");
  });

  it("o pior caso do formato cabe na ficha (20 mil caracteres)", () => {
    const pior = magia({
      tempo: "t".repeat(LIMITES_DO_COMPENDIO.tempo),
      alcance: "a".repeat(LIMITES_DO_COMPENDIO.alcance),
      componentes: "c".repeat(LIMITES_DO_COMPENDIO.componentes),
      duracao: "d".repeat(LIMITES_DO_COMPENDIO.duracao),
      concentracao: true,
      ritual: true,
      descricao: "x".repeat(LIMITES_DO_COMPENDIO.descricao),
      emNiveisSuperiores: "y".repeat(LIMITES_DO_COMPENDIO.emNiveisSuperiores),
    });
    expect(magiaParaFicha(pior).descricao.length).toBeLessThanOrEqual(20_000);
  });

  it("reconhece nome repetido sem acento nem caixa", () => {
    expect(fichaTemMagia([{ nome: "bola de fogo" }], "Bola de Fogo")).toBe(true);
    expect(fichaTemMagia([{ nome: "Mísseis Mágicos" }], "misseis magicos")).toBe(true);
    expect(fichaTemMagia([{ nome: "Luz" }], "Bola de Fogo")).toBe(false);
    expect(fichaTemMagia([], "Bola de Fogo")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Na sala
// ---------------------------------------------------------------------------------------------

const USUARIOS = [
  { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
  { id: "j1", nome: "Jogador 1", papel: "jogador", cor: "#222" },
  { id: "j2", nome: "Jogador 2", papel: "jogador", cor: "#333" },
] as const;

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: USUARIOS,
    pastas: [{ id: "p", nome: "Pers", ordem: 0, visivel: { tipo: "mestre" } }],
    personagens: [
      {
        id: "aldric",
        pastaId: "p",
        editores: { tipo: "jogadores", ids: ["j1"] },
        nome: "Aldric",
        tokenPadrao: { cor: "#fff", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 5, pvMax: 5 },
      },
      {
        id: "ogro",
        pastaId: "p",
        editores: { tipo: "jogadores", ids: [] },
        nome: "Ogro",
        tokenPadrao: { cor: "#f00", tamanhoQuadrados: 2 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 5, pvMax: 5 },
      },
    ],
  });
}

let contador = 0;
const pedido = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });

function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA, fonteComSemente(1));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}: ${r.erro.mensagem}`);
  return r;
}
function erroDe(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA, fonteComSemente(1));
  if (r.ok) throw new Error("devia recusar");
  return r.erro;
}

const metaDoCompendio = (hash = HASH, bytes = 100) => ({
  hash,
  tipo: "compendio",
  mime: "application/json",
  bytes,
  largura: 1,
  altura: 1,
  nomeOriginal: "magias.json",
  pedacos: [`${"e".repeat(63)}1`],
});

function comCompendioRegistrado(hash = HASH): Estado {
  return aplicar(criarEstado(), "m", pedido("asset.registrar", { metas: [metaDoCompendio(hash)] }))
    .estado;
}
const REF = { hash: HASH, nomeOriginal: "magias.json", magias: 3 };
function comCompendio(): Estado {
  return aplicar(comCompendioRegistrado(), "m", pedido("compendio.definir", { compendio: REF }))
    .estado;
}

describe("asset compendio", () => {
  it("a meta é válida só até o limite de tamanho", () => {
    expect(validarMeta(metaDoCompendio() as never)).toBeNull();
    const grande = { ...metaDoCompendio(HASH, 8 * 1024 * 1024 + 1), pedacos: [] as string[] };
    expect(validarMeta(grande as never)).not.toBeNull();
  });

  it("só o mestre registra", () => {
    const e = criarEstado();
    const r = erroDe(e, "j1", pedido("asset.registrar", { metas: [metaDoCompendio()] }));
    expect(r.codigo).toBe("sem_permissao");
  });

  it("o compêndio da mesa é baixável por todo jogador; um antigo não", () => {
    const registrado = comCompendioRegistrado();
    const j1 = { id: "j1", papel: "jogador" as const };
    const j2 = { id: "j2", papel: "jogador" as const };
    // registrado mas ainda não é o da mesa: só o dono (o mestre) vê
    expect(assetVisivelPara(HASH, registrado, j1)).toBe(false);
    expect(assetVisivelPara(HASH, registrado, { id: "m", papel: "mestre" })).toBe(true);

    const definido = aplicar(
      registrado,
      "m",
      pedido("compendio.definir", { compendio: REF }),
    ).estado;
    expect(assetVisivelPara(HASH, definido, j1)).toBe(true);
    expect(assetVisivelPara(HASH, definido, j2)).toBe(true);

    // um segundo asset compendio (arquivo antigo) segue a regra comum
    const comOutro = aplicar(
      definido,
      "m",
      pedido("asset.registrar", { metas: [metaDoCompendio(OUTRO_HASH)] }),
    ).estado;
    expect(assetVisivelPara(OUTRO_HASH, comOutro, j1)).toBe(false);
    expect(assetVisivelPara(HASH, comOutro, j1)).toBe(true);
    // e um assistente nunca vê
    expect(assetVisivelPara(HASH, definido, { id: "x", papel: "assistente" })).toBe(false);
  });
});

describe("compendio.definir", () => {
  it("só o mestre define; o jogador é recusado", () => {
    const e = comCompendioRegistrado();
    expect(erroDe(e, "j1", pedido("compendio.definir", { compendio: REF })).codigo).toBe(
      "sem_permissao",
    );
  });

  it("recusa um hash que não é um asset compendio registrado", () => {
    const e = criarEstado();
    expect(erroDe(e, "m", pedido("compendio.definir", { compendio: REF })).codigo).toBe(
      "asset_inexistente",
    );
    // um asset de outro tipo não serve
    const cifrado = aplicar(
      e,
      "m",
      pedido("asset.registrar", {
        metas: [
          { ...metaDoCompendio(), tipo: "cifrado", bytes: 100, pedacos: [`${"e".repeat(63)}1`] },
        ],
      }),
    ).estado;
    expect(erroDe(cifrado, "m", pedido("compendio.definir", { compendio: REF })).codigo).toBe(
      "asset_inexistente",
    );
  });

  it("define, repete sem evento novo e tira", () => {
    const e = comCompendioRegistrado();
    const r = aplicar(e, "m", pedido("compendio.definir", { compendio: REF }));
    expect(r.estado.compendio).toEqual(REF);
    expect(r.eventos.map((x) => x.tipo)).toEqual(["compendio.alterado"]);
    const igual = aplicar(r.estado, "m", pedido("compendio.definir", { compendio: REF }));
    expect(igual.eventos).toHaveLength(0);
    const tirou = aplicar(r.estado, "m", pedido("compendio.definir", { compendio: null }));
    expect(tirou.estado.compendio).toBeUndefined();
    expect(
      aplicar(tirou.estado, "m", pedido("compendio.definir", { compendio: null })).eventos,
    ).toHaveLength(0);
  });

  it("o compêndio vai no snapshot e nos eventos de todos (só a referência, sem texto)", () => {
    const definido = comCompendio();
    for (const quem of USUARIOS) {
      const v = visaoPara(definido, quem);
      expect(v.compendio).toEqual(REF);
      expect(JSON.stringify(v)).not.toContain("descricao");
    }
    const r = aplicar(
      comCompendioRegistrado(),
      "m",
      pedido("compendio.definir", { compendio: REF }),
    );
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    for (const quem of USUARIOS) {
      const visto = eventoPara(ev, quem, comCompendioRegistrado(), r.estado);
      expect(visto?.tipo).toBe("compendio.alterado");
    }
    // o cliente aplica o mesmo evento e chega ao mesmo estado
    expect(reduzir(comCompendioRegistrado(), ev).compendio).toEqual(REF);
  });

  it("o schema recusa hash inválido e contagem absurda", () => {
    const base = { v: 1, id: "x", tipo: "compendio.definir" };
    expect(
      IntencaoSchema.safeParse({ ...base, dados: { compendio: { ...REF, hash: "abc" } } }).success,
    ).toBe(false);
    expect(
      IntencaoSchema.safeParse({ ...base, dados: { compendio: { ...REF, magias: 99999 } } })
        .success,
    ).toBe(false);
  });
});

describe("exportação v12", () => {
  it("o compêndio (só a referência e a meta) faz a viagem de ida e volta", () => {
    const e = comCompendio();
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(VERSAO_EXPORTACAO);
    expect(VERSAO_EXPORTACAO).toBe(12);
    expect(x.dados.compendio).toEqual(REF);
    expect(x.dados.assets.map((a) => a.hash)).toContain(HASH);
    expect(JSON.stringify(x)).not.toContain("Bola de Fogo");
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.compendio).toEqual(REF);
    const importado = aplicar(criarEstado(), "m", pedido("campanha.importar", { dados: x })).estado;
    expect(importado.compendio).toEqual(REF);
  });

  it("sem compêndio a exportação não traz o campo", () => {
    const x = criarExportacao(criarEstado(), AGORA);
    expect("compendio" in x.dados).toBe(false);
  });

  it("recusa compêndio sem a meta do asset", () => {
    const x = JSON.parse(JSON.stringify(criarExportacao(comCompendio(), AGORA)));
    x.dados.assets = [];
    expect(lerExportacao(x).ok).toBe(false);
  });

  it("uma exportação v11 (sem compêndio) continua importando", () => {
    const x = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), AGORA)));
    x.versao = 11;
    const lida = lerExportacao(x);
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.versao).toBe(12);
    expect(lida.exportacao.dados.compendio).toBeUndefined();
  });

  it("v11 que traz 'compendio' por engano não o aplica: o campo só vale na v12", () => {
    const x = JSON.parse(JSON.stringify(criarExportacao(comCompendio(), AGORA)));
    x.versao = 11;
    const lida = lerExportacao(x);
    if (!lida.ok) throw new Error(lida.motivo);
    expect(lida.exportacao.dados.compendio).toBeUndefined();
  });
});

describe("mensagem magia no chat", () => {
  const bola = exemplo().magias[0] as MagiaDoCompendio;

  function mandar(estado: Estado, quem: string, dados: object) {
    const r = aplicar(estado, quem, pedido("chat.magia", dados));
    const ev = r.eventos[0];
    if (ev?.tipo !== "chat.mensagem") throw new Error("sem mensagem");
    return { ...r, mensagem: ev.dados.mensagem };
  }

  it("publica a magia inteira para todos, como o personagem que eu edito", () => {
    const { mensagem, estado } = mandar(criarEstado(), "j1", { magia: bola, como: "aldric" });
    expect(mensagem).toMatchObject({
      tipo: "magia",
      autorId: "j1",
      visivelPara: "todos",
      como: { personagemId: "aldric", nome: "Aldric" },
    });
    expect(mensagem.magia).toEqual(bola);
    expect(MensagemSchema.safeParse(mensagem).success).toBe(true);
    // todo mundo vê a magia (mensagem pública)
    for (const u of USUARIOS) {
      const vista = chatParaUsuario(estado.chat ?? [], u, estado.config);
      expect(vista).toHaveLength(1);
      expect((vista[0] as Mensagem).magia?.nome).toBe("Bola de Fogo");
    }
  });

  it("sem personagem fala como o próprio usuário", () => {
    const { mensagem } = mandar(criarEstado(), "j2", { magia: bola });
    expect(mensagem.como).toBeUndefined();
  });

  it("'Como:' só de personagem que eu edito (o mestre: qualquer um)", () => {
    expect(
      erroDe(criarEstado(), "j1", pedido("chat.magia", { magia: bola, como: "ogro" })).codigo,
    ).toBe("personagem_inexistente");
    expect(
      erroDe(criarEstado(), "j2", pedido("chat.magia", { magia: bola, como: "aldric" })).codigo,
    ).toBe("personagem_inexistente");
    expect(mandar(criarEstado(), "m", { magia: bola, como: "ogro" }).mensagem.como?.nome).toBe(
      "Ogro",
    );
  });

  it("recusa magia fora dos limites e personagem fantasma", () => {
    const tooLong = { ...bola, descricao: "x".repeat(LIMITES_DO_COMPENDIO.descricao + 1) };
    expect(
      IntencaoSchema.safeParse({ v: 1, id: "a", tipo: "chat.magia", dados: { magia: tooLong } })
        .success,
    ).toBe(false);
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "a",
        tipo: "chat.magia",
        dados: { magia: { ...bola, nivel: 12 } },
      }).success,
    ).toBe(false);
    expect(
      erroDe(criarEstado(), "m", pedido("chat.magia", { magia: bola, como: "fantasma" })).codigo,
    ).toBe("personagem_inexistente");
  });

  it("o resultado que o cliente manda a mais é descartado (só a magia validada entra)", () => {
    const suja = pedido("chat.magia", { magia: { ...bola, extra: "lixo" } });
    const { mensagem } = mandar(criarEstado(), "j1", (suja as { dados: object }).dados);
    expect(mensagem.magia).toEqual(bola);
  });

  it("a mensagem entra no histórico e na exportação não (o chat fica fora)", () => {
    const { estado } = mandar(criarEstado(), "j1", { magia: bola });
    expect(estado.chat).toHaveLength(1);
    expect(JSON.stringify(criarExportacao(estado, AGORA))).not.toContain("Bola de Fogo");
  });
});
